"""每日多來源新聞統整發現引擎。"""

import hashlib
import logging
import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from slugify import slugify

from processor.discovery_processor import DiscoveryProcessor
from scraper.discovery_fetcher import DiscoveryFetcher
from storage.supabase_client import SupabaseStorage

load_dotenv()

logger = logging.getLogger(__name__)


def _get_topics() -> list[str]:
    raw = os.getenv(
        "DISCOVERY_TOPICS",
        "teacher copilots,AI tutoring,learning analytics,assessment innovation",
    )
    return [topic.strip() for topic in raw.split(",") if topic.strip()]


def _build_query(topic: str, coverage_date: str) -> str:
    template = os.getenv(
        "DISCOVERY_QUERY_TEMPLATE",
        "{topic} education technology news {coverage_date}",
    )
    return template.format(topic=topic, coverage_date=coverage_date)


def _build_slug(topic: str, coverage_date: str) -> str:
    base = slugify(f"{coverage_date} {topic}", max_length=72, separator="-")
    digest = hashlib.md5(f"{coverage_date}:{topic}".encode("utf-8")).hexdigest()[:6]
    return f"discoveries-{base}-{digest}"


def run_discovery_pipeline(
    max_topics: int | None = None,
    max_sources_per_topic: int | None = None,
) -> int:
    """抓取多個來源後，生成一篇可引用的新聞統整文章。"""

    logger.info("開始執行 discovery pipeline")
    coverage_date = datetime.now(timezone.utc).date().isoformat()

    try:
        storage = SupabaseStorage()
        fetcher = DiscoveryFetcher()
        processor = DiscoveryProcessor()
    except ValueError as exc:
        logger.warning("Discovery 初始化失敗，略過：%s", exc)
        return 0

    topics = _get_topics()
    if max_topics is not None:
        topics = topics[:max_topics]

    if not topics:
        logger.info("未設定 discovery topics，略過。")
        return 0

    source_limit = max_sources_per_topic or int(
        os.getenv("DISCOVERY_MAX_SOURCES_PER_TOPIC", "5")
    )
    stored_count = 0

    for topic in topics:
        if storage.discovery_report_exists(topic, coverage_date):
            logger.info("Discovery 已存在，略過：%s @ %s", topic, coverage_date)
            continue

        query = _build_query(topic, coverage_date)
        logger.info("Discovery 主題：%s", topic)

        try:
            sources = fetcher.discover(
                query,
                max_results=source_limit,
                coverage_date=coverage_date,
            )
        except Exception as exc:
            logger.error("搜尋主題失敗 [%s]: %s", topic, exc, exc_info=True)
            continue

        if len(sources) < 2:
            logger.warning("主題來源不足，略過：%s（%d 筆）", topic, len(sources))
            continue

        synthesis = processor.summarize_sources(topic, query, sources)
        if not synthesis:
            logger.warning("LLM 無法生成統整報告，略過：%s", topic)
            continue

        record = {
            "slug": _build_slug(topic, coverage_date),
            "topic": topic,
            "query": query,
            "title": synthesis.get("title", topic),
            "summary": synthesis.get("summary", ""),
            "markdown_content": synthesis.get("markdown_content", ""),
            "source_references": sources,
            "tags": synthesis.get("tags", []),
            "source_count": len(sources),
            "coverage_date": coverage_date,
            "model_name": synthesis.get("model_name", ""),
            "is_published": True,
        }

        if storage.insert_discovery_report(record):
            stored_count += 1

    logger.info("Discovery pipeline 完成：共儲存 %d 篇統整報告", stored_count)
    return stored_count


if __name__ == "__main__":
    run_discovery_pipeline()