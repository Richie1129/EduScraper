"""多來源新聞統整的 AI 彙整處理器。"""

import logging
import os
import random
import time
from typing import Optional

from dotenv import load_dotenv
from openai import APIError, APITimeoutError, OpenAI, RateLimitError

from .ai_processor import (
    _extract_json,
    _should_fast_fallback_empty_response,
    _should_fast_fallback_json_error,
)
from .prompts import DISCOVERY_SYSTEM_PROMPT, build_discovery_prompt

load_dotenv()

logger = logging.getLogger(__name__)

_DISCOVERY_REQUIRED_FIELDS = {"title", "summary", "markdown_content", "tags"}


class DiscoveryProcessor:
    """沿用既有 vLLM 基礎設施，生成帶引用的新聞統整文章。"""

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

        servers = [server for server in [primary, hsueh] if server["base_url"] and server["model"]]
        if not servers:
            raise ValueError("至少需要設定一組 vLLM 伺服器環境變數")

        random.shuffle(servers)
        self._servers = servers

    def summarize_sources(
        self, topic: str, query: str, sources: list[dict]
    ) -> Optional[dict]:
        prompt = build_discovery_prompt(topic, query, sources)
        topic_preview = topic[:60]

        for server in self._servers:
            result = self._try_server(server, prompt, topic_preview)
            if result is not None:
                return result
            logger.info("Discovery 改用下一台伺服器（fallback）：%s", topic_preview)

        logger.error("Discovery 所有伺服器皆失敗：%s", topic_preview)
        return None

    def _try_server(
        self, server: dict, prompt: str, topic_preview: str
    ) -> Optional[dict]:
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
                        {"role": "system", "content": DISCOVERY_SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0.15,
                    max_tokens=4200,
                )

                raw_content = response.choices[0].message.content
                finish_reason = response.choices[0].finish_reason

                if not raw_content:
                    logger.warning(
                        "[%s] Discovery 回應為空（finish_reason=%s）（第 %d 次）主題：%s",
                        label,
                        finish_reason,
                        attempt,
                        topic_preview,
                    )
                    if _should_fast_fallback_empty_response(finish_reason):
                        break
                    if attempt < 3:
                        time.sleep(2)
                    continue

                data = _extract_json(raw_content)
                missing = _DISCOVERY_REQUIRED_FIELDS - set(data.keys())
                if missing:
                    logger.warning(
                        "[%s] Discovery 回應缺少欄位 %s（第 %d 次）主題：%s",
                        label,
                        missing,
                        attempt,
                        topic_preview,
                    )
                    if attempt < 3:
                        time.sleep(2)
                        continue

                tags = data.get("tags", [])
                if not isinstance(tags, list):
                    data["tags"] = []
                else:
                    data["tags"] = [str(tag).lower() for tag in tags[:5]]

                data["model_name"] = model
                return data

            except ValueError as exc:
                logger.warning(
                    "[%s] Discovery JSON 解析失敗（第 %d 次）主題：%s — %s",
                    label,
                    attempt,
                    topic_preview,
                    exc,
                )
                if _should_fast_fallback_json_error(raw_content, finish_reason):
                    break
                if attempt < 3:
                    time.sleep(2)

            except (RateLimitError, APITimeoutError) as exc:
                logger.warning(
                    "[%s] Discovery 速率限制或逾時（第 %d 次）主題：%s — %s",
                    label,
                    attempt,
                    topic_preview,
                    exc,
                )
                time.sleep(10 * attempt)

            except APIError as exc:
                logger.error(
                    "[%s] Discovery API 錯誤（第 %d 次）主題：%s — %s",
                    label,
                    attempt,
                    topic_preview,
                    exc,
                )
                if attempt < 3:
                    time.sleep(5)

            except Exception as exc:
                logger.error(
                    "[%s] Discovery 未預期錯誤（第 %d 次）主題：%s — %s",
                    label,
                    attempt,
                    topic_preview,
                    exc,
                    exc_info=True,
                )
                break

        return None