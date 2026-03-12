"""
批次為既有文章回填更完整的 ai_highlights。

用法：
  python -m pipeline.backfill_ai_highlights --limit 20
  python -m pipeline.backfill_ai_highlights --limit 50 --batch-size 10
  python -m pipeline.backfill_ai_highlights --refresh-all
  python -m pipeline.backfill_ai_highlights --dry-run
"""

import argparse
import logging
import os
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv()

_handlers: list = [logging.StreamHandler(sys.stdout)]
_log_dir = os.environ.get("LOG_DIR", "logs")
try:
    os.makedirs(_log_dir, exist_ok=True)
    _handlers.append(
        logging.FileHandler(
            os.path.join(_log_dir, "ai_highlights_backfill.log"), encoding="utf-8"
        )
    )
except OSError:
    pass

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=_handlers,
)
logger = logging.getLogger(__name__)

from processor.ai_processor import VLLMProcessor  # noqa: E402
from storage.supabase_client import SupabaseStorage  # noqa: E402


def run_backfill(
    limit: int,
    batch_size: int,
    refresh_all: bool = False,
    dry_run: bool = False,
) -> int:
    """批次回填現有文章的 ai_highlights。"""
    logger.info("=" * 60)
    logger.info("ai_highlights 回填開始 %s", datetime.now(timezone.utc).isoformat())
    logger.info(
        "參數：limit=%d, batch_size=%d, refresh_all=%s, dry_run=%s",
        limit,
        batch_size,
        refresh_all,
        dry_run,
    )

    try:
        storage = SupabaseStorage()
        processor = VLLMProcessor()
    except ValueError as exc:
        logger.error("初始化失敗：%s", exc)
        return 0

    processed_count = 0
    updated_count = 0
    offset = 0

    while processed_count < limit:
        remaining = limit - processed_count
        current_batch_size = min(batch_size, remaining)
        articles = storage.get_articles_for_ai_highlights_backfill(
            limit=current_batch_size,
            offset=offset,
            refresh_all=refresh_all,
        )

        if not articles:
            logger.info("沒有更多待回填文章，提前結束。")
            break

        logger.info("本批次取得 %d 篇文章", len(articles))

        for article in articles:
            if processed_count >= limit:
                break

            processed_count += 1
            article_label = (
                article.get("translated_title")
                or article.get("original_title")
                or "（無標題）"
            )
            logger.info("[%d/%d] 回填：%s", processed_count, limit, article_label[:80])

            ai_result = processor.process_ai_highlights(article)
            if not ai_result:
                logger.warning("  ✗ 無法生成 ai_highlights，略過")
                continue

            if dry_run:
                logger.info("  ✓ dry-run 生成成功，共 %d 個重點", len(ai_result["ai_highlights"]))
                updated_count += 1
                continue

            success = storage.update_article_ai_highlights(
                article_id=article["id"],
                ai_highlights=ai_result["ai_highlights"],
                model_name=ai_result.get("model_name"),
            )
            if success:
                updated_count += 1
                logger.info("  ✓ 已更新 ai_highlights")
            else:
                logger.warning("  ✗ 更新失敗")

        if refresh_all or dry_run:
            offset += max(current_batch_size * 3, current_batch_size)
        else:
            # 非 refresh 模式下，每次都從最新候選重新抓。
            # 已更新的文章會自動從候選清單消失，避免因 offset 跳動而漏掉同批次內的其他候選。
            offset = 0

    logger.info(
        "回填完成：處理 %d 篇，成功 %d 篇",
        processed_count,
        updated_count,
    )
    logger.info("=" * 60)
    return updated_count


def main() -> None:
    parser = argparse.ArgumentParser(description="回填既有文章的 ai_highlights")
    parser.add_argument(
        "--limit",
        type=int,
        default=20,
        help="最多處理幾篇文章（預設：20）",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=5,
        help="每批向資料庫撈取與處理的篇數（預設：5）",
    )
    parser.add_argument(
        "--refresh-all",
        action="store_true",
        help="不只補空值，也重新產生已有 ai_highlights 的文章",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="只生成內容不寫回資料庫",
    )
    args = parser.parse_args()

    updated = run_backfill(
        limit=max(args.limit, 1),
        batch_size=max(args.batch_size, 1),
        refresh_all=args.refresh_all,
        dry_run=args.dry_run,
    )
    sys.exit(0 if updated >= 0 else 1)


if __name__ == "__main__":
    main()