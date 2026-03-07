"""
AI 內容處理模組
透過 OpenAI 相容 API 介面呼叫 vLLM，對文章進行翻譯與結構化摘要。
"""

import json
import logging
import os
import re
import time
from typing import Optional

from openai import OpenAI, APIError, APITimeoutError, RateLimitError
from dotenv import load_dotenv

from .prompts import SYSTEM_PROMPT, build_analysis_prompt

load_dotenv()

logger = logging.getLogger(__name__)


def _clean_trailing_commas(text: str) -> str:
    """移除 JSON 字串中的尾隨逗號（陣列或物件最後一個元素後的逗號）。"""
    return re.sub(r',(\s*[}\]])', r'\1', text)


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
    match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
    if match:
        try:
            return try_loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # 3. 提取文字中第一個 { 到最後一個 } 之間的內容
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end > start:
        try:
            return try_loads(text[start:end + 1])
        except json.JSONDecodeError:
            pass

    raise json.JSONDecodeError("無法從回應中提取有效 JSON", text, 0)


# vLLM 回應必須包含這些欄位
_REQUIRED_FIELDS = {
    "translated_title",
    "one_sentence_summary",
    "key_findings",
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

    def __init__(self, use_hsueh: bool = False):
        use_backup = use_hsueh or os.getenv("USE_HSUEH_VLLM", "false").lower() == "true"

        if use_backup:
            base_url = os.getenv("HSUEH_VLLM_BASE_URL")
            api_key = os.getenv("HSUEH_VLLM_API_KEY", "dummy")
            self.model = os.getenv("HSUEH_VLLM_MODEL_NAME")
            server_label = "Hsueh vLLM"
        else:
            base_url = os.getenv("VLLM_BASE_URL")
            api_key = os.getenv("VLLM_API_KEY")
            self.model = os.getenv("VLLM_MODEL_NAME")
            server_label = "Primary vLLM"

        if not base_url:
            raise ValueError(f"vLLM base URL 未設定（伺服器：{server_label}）")
        if not self.model:
            raise ValueError(f"vLLM model name 未設定（伺服器：{server_label}）")

        self.client = OpenAI(base_url=base_url, api_key=api_key or "dummy")
        logger.info("VLLMProcessor 初始化完成 [%s] 模型：%s", server_label, self.model)

    def process_article(self, article: dict) -> Optional[dict]:
        """
        將文章傳送至 vLLM 進行 AI 處理，回傳結構化摘要字典。
        失敗時回傳 None。
        """
        prompt = build_analysis_prompt(article)
        title_preview = article.get("original_title", "")[:60]
        raw_content: Optional[str] = None

        for attempt in range(1, 4):  # 最多重試 3 次
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0.2,
                    max_tokens=2500,
                )

                raw_content = response.choices[0].message.content
                finish_reason = response.choices[0].finish_reason

                if not raw_content:
                    logger.warning(
                        "vLLM 回應內容為空（finish_reason=%s）（第 %d 次）文章：%s",
                        finish_reason, attempt, title_preview,
                    )
                    if attempt < 3:
                        time.sleep(2)
                    continue

                data = _extract_json(raw_content)

                # 驗證必要欄位
                missing = _REQUIRED_FIELDS - set(data.keys())
                if missing:
                    logger.warning(
                        "AI 回應缺少欄位 %s，文章：%s（第 %d 次）",
                        missing, title_preview, attempt,
                    )
                    if attempt < 3:
                        time.sleep(2)
                        continue

                # 確保 key_findings 是包含最多 5 個字串的列表
                findings = data.get("key_findings", [])
                if not isinstance(findings, list) or len(findings) < 1:
                    data["key_findings"] = []
                else:
                    data["key_findings"] = [str(f) for f in findings[:5]]

                # 確保 tags 是字串列表
                tags = data.get("tags", [])
                if not isinstance(tags, list):
                    data["tags"] = []
                else:
                    data["tags"] = [str(t).lower() for t in tags[:5]]

                # 確保 relevance_score 是整數
                try:
                    data["relevance_score"] = int(data.get("relevance_score", 5))
                except (ValueError, TypeError):
                    data["relevance_score"] = 5

                # 注入使用的模型名稱
                data["model_name"] = self.model

                logger.debug("AI 處理成功：%s", title_preview)
                return data

            except json.JSONDecodeError as exc:
                logger.warning(
                    "JSON 解析失敗（第 %d 次）文章：%s — %s\n  回應前300字：%s",
                    attempt, title_preview, exc,
                    raw_content[:300] if raw_content else "(空回應)",
                )
                if attempt < 3:
                    time.sleep(2)

            except (RateLimitError, APITimeoutError) as exc:
                logger.warning(
                    "API 速率限制或逾時（第 %d 次）文章：%s — %s",
                    attempt, title_preview, exc,
                )
                time.sleep(10 * attempt)

            except APIError as exc:
                logger.error(
                    "vLLM API 錯誤（第 %d 次）文章：%s — %s",
                    attempt, title_preview, exc,
                )
                if attempt < 3:
                    time.sleep(5)

            except Exception as exc:
                logger.error(
                    "未預期錯誤（第 %d 次）文章：%s — %s",
                    attempt, title_preview, exc, exc_info=True,
                )
                break

        logger.error("AI 處理失敗，已放棄：%s", title_preview)
        return None
