"""
AI 內容處理模組
透過 OpenAI 相容 API 介面呼叫 vLLM，對文章進行翻譯與結構化摘要。
"""

import json
import logging
import os
import random
import re
import time
from typing import Optional

from openai import OpenAI, APIError, APITimeoutError, RateLimitError
from dotenv import load_dotenv

from .prompts import (
    AI_HIGHLIGHTS_SYSTEM_PROMPT,
    SYSTEM_PROMPT,
    build_ai_highlights_backfill_prompt,
    build_analysis_prompt,
)

load_dotenv()

logger = logging.getLogger(__name__)

_FAST_FALLBACK_FINISH_REASONS = {"length"}


def _clean_trailing_commas(text: str) -> str:
    """移除 JSON 字串中的尾隨逗號（陣列或物件最後一個元素後的逗號）。"""
    return re.sub(r",(\s*[}\]])", r"\1", text)


def _extract_json(text: str) -> dict:
    """
    從模型回應文字中嘗試提取 JSON 物件。
    依序嘗試：直接解析 → markdown code block → 首尾 { } 配對。
    支援帶尾隨逗號的非標準 JSON。
    """

    def try_loads(s: str) -> dict:
        try:
            return json.loads(s)
        except json.JSONDecodeError:
            # 嘗試移除尾隨逗號後再解析
            cleaned = _clean_trailing_commas(s)
            return json.loads(cleaned)

    # 1. 直接解析
    try:
        return try_loads(text)
    except json.JSONDecodeError:
        pass

    # 2. 嘗試 ```json ... ``` 或 ``` ... ``` 代碼塊
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        try:
            return try_loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # 3. 提取文字中第一個 { 到最後一個 } 之間的內容
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        try:
            return try_loads(text[start : end + 1])
        except json.JSONDecodeError:
            pass

    raise json.JSONDecodeError("無法從回應中提取有效 JSON", text, 0)


def _should_fast_fallback_empty_response(finish_reason: Optional[str]) -> bool:
    """空回應且顯示被截斷時，直接切換下一台伺服器。"""
    return finish_reason in _FAST_FALLBACK_FINISH_REASONS


def _should_fast_fallback_json_error(
    raw_content: Optional[str], finish_reason: Optional[str]
) -> bool:
    """當回應明顯因長度截斷而導致 JSON 不完整時，直接 fallback。"""
    if finish_reason not in _FAST_FALLBACK_FINISH_REASONS or not raw_content:
        return False

    stripped = raw_content.strip()
    if not stripped:
        return True

    open_braces = stripped.count("{")
    close_braces = stripped.count("}")
    return open_braces > close_braces


# vLLM 回應必須包含這些欄位
_REQUIRED_FIELDS = {
    "translated_title",
    "one_sentence_summary",
    "key_findings",
    "ai_highlights",
    "research_method",
    "target_audience",
    "practical_insights",
    "tags",
    "relevance_score",
}


class VLLMProcessor:
    """
    封裝 vLLM (OpenAI-compatible) API 呼叫，
    支援主要伺服器與備用伺服器自動切換。
    """

    def __init__(self):
        primary = {
            "base_url": os.getenv("VLLM_BASE_URL"),
            "api_key": os.getenv("VLLM_API_KEY"),
            "model": os.getenv("VLLM_MODEL_NAME"),
            "label": "Primary vLLM",
        }
        hsueh = {
            "base_url": os.getenv("HSUEH_VLLM_BASE_URL"),
            "api_key": os.getenv("HSUEH_VLLM_API_KEY"),
            "model": os.getenv("HSUEH_VLLM_MODEL_NAME"),
            "label": "Hsueh vLLM",
        }

        # 過濾掉未設定的伺服器
        servers = [s for s in [primary, hsueh] if s["base_url"] and s["model"]]
        if not servers:
            raise ValueError("至少需要設定一組 vLLM 伺服器環境變數")

        # 隨機決定優先順序，另一台作為 fallback
        random.shuffle(servers)
        self._servers = servers
        logger.info(
            "VLLMProcessor 初始化完成，呼叫順序：%s",
            " → ".join(s["label"] for s in servers),
        )

    def _try_server(
        self, server: dict, prompt: str, title_preview: str
    ) -> Optional[dict]:
        """對單一伺服器最多重試 3 次，成功回傳結構化資料，失敗回傳 None。"""
        client = OpenAI(
            base_url=server["base_url"], api_key=server["api_key"] or "dummy"
        )
        model: str = server["model"]
        label: str = server["label"]
        raw_content: Optional[str] = None
        finish_reason: Optional[str] = None

        for attempt in range(1, 4):
            try:
                response = client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0.2,
                    max_tokens=3200,
                )

                raw_content = response.choices[0].message.content
                finish_reason = response.choices[0].finish_reason

                if not raw_content:
                    logger.warning(
                        "[%s] 回應內容為空（finish_reason=%s）（第 %d 次）文章：%s",
                        label,
                        finish_reason,
                        attempt,
                        title_preview,
                    )
                    if _should_fast_fallback_empty_response(finish_reason):
                        logger.warning(
                            "[%s] 偵測到回應因長度截斷，直接切換下一台伺服器：%s",
                            label,
                            title_preview,
                        )
                        break
                    if attempt < 3:
                        time.sleep(2)
                    continue

                data = _extract_json(raw_content)

                missing = _REQUIRED_FIELDS - set(data.keys())
                if missing:
                    logger.warning(
                        "[%s] 回應缺少欄位 %s，文章：%s（第 %d 次）",
                        label,
                        missing,
                        title_preview,
                        attempt,
                    )
                    if attempt < 3:
                        time.sleep(2)
                        continue

                findings = data.get("key_findings", [])
                if not isinstance(findings, list) or len(findings) < 1:
                    data["key_findings"] = []
                else:
                    data["key_findings"] = [str(f) for f in findings[:5]]

                highlights = data.get("ai_highlights", [])
                normalized_highlights = []
                if isinstance(highlights, list):
                    for highlight in highlights[:4]:
                        if not isinstance(highlight, dict):
                            continue

                        point = str(
                            highlight.get("point") or highlight.get("finding") or ""
                        ).strip()
                        reason = str(
                            highlight.get("reason")
                            or highlight.get("why_it_matters")
                            or ""
                        ).strip()

                        if point and reason:
                            normalized_highlights.append(
                                {"point": point, "reason": reason}
                            )

                if not normalized_highlights and data["key_findings"]:
                    normalized_highlights = [
                        {
                            "point": finding,
                            "reason": "AI 判定這一點重要，因為它直接影響讀者理解本研究的核心價值。",
                        }
                        for finding in data["key_findings"][:3]
                    ]

                data["ai_highlights"] = normalized_highlights

                tags = data.get("tags", [])
                if not isinstance(tags, list):
                    data["tags"] = []
                else:
                    data["tags"] = [str(t).lower() for t in tags[:5]]

                try:
                    data["relevance_score"] = int(data.get("relevance_score", 5))
                except (ValueError, TypeError):
                    data["relevance_score"] = 5

                data["model_name"] = model
                logger.debug("[%s] AI 處理成功：%s", label, title_preview)
                return data

            except json.JSONDecodeError as exc:
                logger.warning(
                    "[%s] JSON 解析失敗（第 %d 次）文章：%s — %s\n  回應前300字：%s",
                    label,
                    attempt,
                    title_preview,
                    exc,
                    raw_content[:300] if raw_content else "(空回應)",
                )
                if _should_fast_fallback_json_error(raw_content, finish_reason):
                    logger.warning(
                        "[%s] 偵測到 JSON 因長度截斷不完整，直接切換下一台伺服器：%s",
                        label,
                        title_preview,
                    )
                    break
                if attempt < 3:
                    time.sleep(2)

            except (RateLimitError, APITimeoutError) as exc:
                logger.warning(
                    "[%s] 速率限制或逾時（第 %d 次）文章：%s — %s",
                    label,
                    attempt,
                    title_preview,
                    exc,
                )
                time.sleep(10 * attempt)

            except APIError as exc:
                logger.error(
                    "[%s] API 錯誤（第 %d 次）文章：%s — %s",
                    label,
                    attempt,
                    title_preview,
                    exc,
                )
                if attempt < 3:
                    time.sleep(5)

            except Exception as exc:
                logger.error(
                    "[%s] 未預期錯誤（第 %d 次）文章：%s — %s",
                    label,
                    attempt,
                    title_preview,
                    exc,
                    exc_info=True,
                )
                break

        logger.warning("[%s] 重試 3 次失敗，放棄此伺服器：%s", label, title_preview)
        return None

    def process_article(self, article: dict) -> Optional[dict]:
        """
        隨機選擇一台 vLLM 伺服器處理文章，失敗時自動 fallback 至另一台。
        兩台都失敗才放棄，回傳 None。
        """
        title_preview = article.get("original_title", "")[:60]
        try:
            prompt = build_analysis_prompt(article)
        except Exception as exc:
            logger.error("Prompt 建立失敗，跳過：%s — %s", title_preview, exc, exc_info=True)
            return None

        for server in self._servers:
            result = self._try_server(server, prompt, title_preview)
            if result is not None:
                return result
            logger.info("嘗試下一台伺服器（fallback）：%s", title_preview)

        logger.error("所有伺服器均失敗，已放棄：%s", title_preview)
        return None

    def process_ai_highlights(self, article: dict) -> Optional[dict]:
        """僅為既有文章生成 ai_highlights。"""
        prompt = build_ai_highlights_backfill_prompt(article)
        title_preview = (
            article.get("translated_title") or article.get("original_title", "")
        )[:60]

        for server in self._servers:
            client = OpenAI(
                base_url=server["base_url"], api_key=server["api_key"] or "dummy"
            )
            model: str = server["model"]
            label: str = server["label"]
            raw_content: Optional[str] = None
            finish_reason: Optional[str] = None

            for attempt in range(1, 4):
                try:
                    response = client.chat.completions.create(
                        model=model,
                        messages=[
                            {
                                "role": "system",
                                "content": AI_HIGHLIGHTS_SYSTEM_PROMPT,
                            },
                            {"role": "user", "content": prompt},
                        ],
                        temperature=0.2,
                        max_tokens=900,
                    )

                    raw_content = response.choices[0].message.content
                    finish_reason = response.choices[0].finish_reason

                    if not raw_content:
                        logger.warning(
                            "[%s] ai_highlights 回應為空（finish_reason=%s）（第 %d 次）文章：%s",
                            label,
                            finish_reason,
                            attempt,
                            title_preview,
                        )
                        if _should_fast_fallback_empty_response(finish_reason):
                            break
                        if attempt < 3:
                            time.sleep(2)
                        continue

                    data = _extract_json(raw_content)
                    highlights = data.get("ai_highlights", [])
                    normalized_highlights = []

                    if isinstance(highlights, list):
                        for highlight in highlights[:3]:
                            if not isinstance(highlight, dict):
                                continue

                            point = str(highlight.get("point") or "").strip()
                            reason = str(highlight.get("reason") or "").strip()
                            if point and reason:
                                normalized_highlights.append(
                                    {"point": point, "reason": reason}
                                )

                    if normalized_highlights:
                        logger.debug("[%s] ai_highlights 生成成功：%s", label, title_preview)
                        return {
                            "ai_highlights": normalized_highlights,
                            "model_name": model,
                        }

                    logger.warning(
                        "[%s] ai_highlights 缺少有效內容（第 %d 次）文章：%s",
                        label,
                        attempt,
                        title_preview,
                    )
                    if attempt < 3:
                        time.sleep(2)

                except json.JSONDecodeError as exc:
                    logger.warning(
                        "[%s] ai_highlights JSON 解析失敗（第 %d 次）文章：%s — %s\n  回應前300字：%s",
                        label,
                        attempt,
                        title_preview,
                        exc,
                        raw_content[:300] if raw_content else "(空回應)",
                    )
                    if _should_fast_fallback_json_error(raw_content, finish_reason):
                        break
                    if attempt < 3:
                        time.sleep(2)

                except (RateLimitError, APITimeoutError) as exc:
                    logger.warning(
                        "[%s] ai_highlights 速率限制或逾時（第 %d 次）文章：%s — %s",
                        label,
                        attempt,
                        title_preview,
                        exc,
                    )
                    time.sleep(10 * attempt)

                except APIError as exc:
                    logger.error(
                        "[%s] ai_highlights API 錯誤（第 %d 次）文章：%s — %s",
                        label,
                        attempt,
                        title_preview,
                        exc,
                    )
                    if attempt < 3:
                        time.sleep(5)

                except Exception as exc:
                    logger.error(
                        "[%s] ai_highlights 未預期錯誤（第 %d 次）文章：%s — %s",
                        label,
                        attempt,
                        title_preview,
                        exc,
                        exc_info=True,
                    )
                    break

            logger.info("ai_highlights 改用下一台伺服器（fallback）：%s", title_preview)

        logger.error("所有伺服器均失敗，無法生成 ai_highlights：%s", title_preview)
        return None
