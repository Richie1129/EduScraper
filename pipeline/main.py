"""
EduScraper 主要資料管線

執行流程：
  1. 從所有 RSS 來源抓取最新文章
  2. 過濾掉已存在於資料庫的文章
  3. 透過 vLLM 進行 AI 翻譯與摘要
  4. 相關度評分過低的文章自動跳過
  5. 將結構化資料儲存至 Supabase

用法：
  python -m pipeline.main
  python -m pipeline.main --limit 20
"""

import argparse
import hashlib
import logging
import os
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv
from slugify import slugify

load_dotenv()

# ── 日誌設定 ──────────────────────────────────────────────────────
_handlers: list = [logging.StreamHandler(sys.stdout)]
_log_dir = os.environ.get("LOG_DIR", "logs")
try:
    os.makedirs(_log_dir, exist_ok=True)
    _handlers.append(
        logging.FileHandler(os.path.join(_log_dir, "eduscraper.log"), encoding="utf-8")
    )
except OSError:
    pass  # 無法建立日誌目錄時僅輸出至 stdout

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=_handlers,
)
logger = logging.getLogger(__name__)

# ── 延遲匯入（確保日誌設定完成後再匯入子模組） ────────────────────
from scraper.sources import RSS_SOURCES, SCRAPE_SOURCES  # noqa: E402
from scraper.rss_fetcher import fetch_all_feeds  # noqa: E402
from scraper.web_scraper import fetch_all_scrape_sources  # noqa: E402
from processor.ai_processor import VLLMProcessor  # noqa: E402
from storage.supabase_client import SupabaseStorage  # noqa: E402


def generate_slug(original_title: str, source_url: str) -> str:
    """
    根據英文原始標題生成 URL 安全的 slug。
    加入 source_url 的短雜湊（6 碼）確保唯一性。
    """
    base = slugify(original_title, max_length=80, word_boundary=True, separator="-")
    if not base:
        base = "article"

    url_hash = hashlib.md5(source_url.encode("utf-8")).hexdigest()[:6]
    return f"{base}-{url_hash}"


def ensure_unique_slug(slug: str, storage: SupabaseStorage) -> str:
    """若 slug 已存在，在末尾附加時間戳記以確保唯一性。"""
    if not storage.slug_exists(slug):
        return slug
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M")
    return f"{slug}-{timestamp}"


def _dedupe_articles_by_url(articles: list[dict]) -> list[dict]:
    """依 source_url 去重，保留原始順序。"""
    seen: set[str] = set()
    deduped: list[dict] = []

    for article in articles:
        url = article.get("source_url")
        if not url or url in seen:
            continue
        seen.add(url)
        deduped.append(article)

    return deduped


def run_pipeline(max_articles: int = 50) -> int:
    """
    執行完整資料管線。

    Args:
        max_articles: 此次執行最多處理的文章數量

    Returns:
        int: 成功儲存的文章數量
    """
    logger.info("=" * 60)
    logger.info("EduScraper 管線啟動 %s", datetime.now(timezone.utc).isoformat())
    logger.info("=" * 60)

    relevance_threshold = int(os.getenv("RELEVANCE_SCORE_THRESHOLD", "5"))

    # ── 初始化服務 ────────────────────────────────────────────────
    try:
        storage = SupabaseStorage()
        processor = VLLMProcessor()
    except ValueError as exc:
        logger.error("初始化失敗：%s", exc)
        return 0

    # ── 步驟 1：抓取來源 ──────────────────────────────────────────
    logger.info(
        "步驟 1/3：抓取內容來源（RSS %d 個，補充爬蟲 %d 個）",
        len(RSS_SOURCES),
        len(SCRAPE_SOURCES),
    )
    rss_articles = fetch_all_feeds(RSS_SOURCES)
    scrape_articles = fetch_all_scrape_sources(SCRAPE_SOURCES)
    all_articles = _dedupe_articles_by_url(rss_articles + scrape_articles)
    logger.info(
        "抓取完成：RSS %d 篇 + 補充爬蟲 %d 篇，合併去重後 %d 篇",
        len(rss_articles),
        len(scrape_articles),
        len(all_articles),
    )

    # ── 步驟 2：過濾已存在文章 ────────────────────────────────────
    logger.info("步驟 2/3：過濾已存在的文章…")
    new_articles = [
        a for a in all_articles if not storage.article_exists(a["source_url"])
    ]
    logger.info(
        "過濾完成：%d 篇已存在，%d 篇待處理",
        len(all_articles) - len(new_articles),
        len(new_articles),
    )

    # 套用每次執行的數量上限
    if len(new_articles) > max_articles:
        logger.info("依上限截斷至 %d 篇", max_articles)
        new_articles = new_articles[:max_articles]

    if not new_articles:
        logger.info("沒有需要處理的新文章，管線結束。")
        return 0

    # ── 步驟 3：AI 處理 + 儲存 ───────────────────────────────────
    logger.info("步驟 3/3：AI 處理與儲存（共 %d 篇）", len(new_articles))
    stored_count = 0
    skipped_count = 0

    for i, article in enumerate(new_articles, start=1):
        title_preview = article["original_title"][:60]
        logger.info("[%d/%d] 處理中：%s…", i, len(new_articles), title_preview)

        try:
            # AI 翻譯與摘要
            ai_data = processor.process_article(article)
            if not ai_data:
                logger.warning("  ✗ AI 處理失敗，跳過")
                skipped_count += 1
                continue

            # 相關度篩選
            score = ai_data.get("relevance_score", 0)
            if score < relevance_threshold:
                logger.info(
                    "  ✗ 相關度過低（%d < %d），跳過", score, relevance_threshold
                )
                skipped_count += 1
                continue

            # 建立資料庫記錄
            translated_title = (
                ai_data.get("translated_title") or article["original_title"]
            )
            slug = ensure_unique_slug(
                generate_slug(article["original_title"], article["source_url"]),
                storage,
            )

            record = {
                "slug": slug,
                "original_title": article["original_title"],
                "translated_title": translated_title,
                "source_url": article["source_url"],
                "source_name": article.get("source_name", ""),
                "authors": article.get("authors", []),
                "original_abstract": article.get("original_abstract", ""),
                "one_sentence_summary": ai_data.get("one_sentence_summary", ""),
                "key_findings": ai_data.get("key_findings", []),
                "research_method": ai_data.get("research_method", ""),
                "target_audience": ai_data.get("target_audience", ""),
                "practical_insights": ai_data.get("practical_insights", ""),
                "tags": ai_data.get("tags", article.get("tags", [])),
                "relevance_score": score,
                "model_name": ai_data.get("model_name", ""),
                "published_at": article.get("published_at"),
                "is_published": True,
            }

            result = storage.insert_article(record)
            if result:
                stored_count += 1
                logger.info("  ✓ 已儲存：%s", translated_title[:60])
            else:
                skipped_count += 1

        except Exception as exc:
            logger.error("  ✗ 未預期錯誤：%s", exc, exc_info=True)
            skipped_count += 1

    # ── 完成摘要 ──────────────────────────────────────────────────
    logger.info("=" * 60)
    logger.info(
        "管線完成：儲存 %d 篇 | 跳過 %d 篇 | 耗時至 %s",
        stored_count,
        skipped_count,
        datetime.now(timezone.utc).isoformat(),
    )
    logger.info("=" * 60)
    return stored_count


def main():
    parser = argparse.ArgumentParser(description="EduScraper 資料管線")
    parser.add_argument(
        "--limit",
        type=int,
        default=int(os.getenv("MAX_ARTICLES_PER_RUN", "50")),
        help="每次執行最多處理的文章數量（預設：50）",
    )
    args = parser.parse_args()

    count = run_pipeline(max_articles=args.limit)
    sys.exit(0 if count >= 0 else 1)


if __name__ == "__main__":
    main()
