"""
PostgreSQL 資料庫操作模組
提供文章、統整報告的 CRUD 操作，透過 DATABASE_URL 直接連線資料庫。
"""

import json
import logging
import os
from typing import Any, List, Optional

import psycopg
from dotenv import load_dotenv
from psycopg import sql
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

load_dotenv()

logger = logging.getLogger(__name__)

_GENERIC_AI_HIGHLIGHT_REASON = (
    "AI 判定這一點重要，因為它直接影響讀者理解本研究的核心價值。"
)

# 可寫入的欄位白名單（表格欄位以 db/schema.sql 為準）
_ARTICLE_COLUMNS = {
    "slug", "original_title", "translated_title", "source_url", "source_name",
    "authors", "original_abstract", "one_sentence_summary", "key_findings",
    "ai_highlights", "research_method", "target_audience", "practical_insights",
    "tags", "relevance_score", "model_name", "published_at", "is_published",
}
_DISCOVERY_COLUMNS = {
    "slug", "topic", "query", "title", "summary", "markdown_content",
    "source_references", "tags", "source_count", "coverage_date", "model_name",
    "is_published",
}
# psycopg 不會自動把 Python list / dict 轉成 JSONB，需明確包裝
_JSONB_COLUMNS = {"key_findings", "ai_highlights", "source_references"}


def _dump_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


class PostgresStorage:
    """封裝 PostgreSQL 的文章與統整報告資料表操作。"""

    def __init__(self):
        self._dsn = os.getenv("DATABASE_URL")
        if not self._dsn:
            raise ValueError("請在 .env 中設定 DATABASE_URL")

        try:
            self._conn = self._open()
        except psycopg.Error as exc:
            raise ValueError(f"無法連線資料庫：{exc}") from exc
        logger.info("PostgreSQL 連線初始化完成")

    # ── 連線與底層查詢 ────────────────────────────────────────────

    def _open(self) -> "psycopg.Connection[dict]":
        # autocommit：每個語句獨立提交，單筆失敗不會使後續語句落入 aborted transaction
        return psycopg.connect(
            self._dsn, autocommit=True, row_factory=dict_row, connect_timeout=10
        )

    def _reconnect(self) -> None:
        if not self._conn.closed:
            self._conn.close()
        self._conn = self._open()

    def _query(self, statement: Any, params: Any = None) -> List[dict]:
        """執行語句並回傳所有資料列；連線中斷時自動重連一次（管線可能長時間閒置）。"""
        for attempt in (1, 2):
            try:
                with self._conn.cursor() as cur:
                    cur.execute(statement, params)
                    return cur.fetchall() if cur.description else []
            except psycopg.OperationalError:
                if attempt == 2:
                    raise
                logger.warning("資料庫連線中斷，嘗試重新連線")
                self._reconnect()
        return []

    def _insert(self, table: str, data: dict, allowed: set) -> Optional[dict]:
        unknown = set(data) - allowed
        if unknown:
            logger.warning("忽略 %s 不存在的欄位：%s", table, sorted(unknown))

        columns = [key for key in data if key in allowed]
        values = [
            Jsonb(data[key], dumps=_dump_json) if key in _JSONB_COLUMNS else data[key]
            for key in columns
        ]
        statement = sql.SQL("INSERT INTO {} ({}) VALUES ({}) RETURNING *").format(
            sql.Identifier(table),
            sql.SQL(", ").join(sql.Identifier(column) for column in columns),
            sql.SQL(", ").join(sql.Placeholder() * len(columns)),
        )
        rows = self._query(statement, values)
        return rows[0] if rows else None

    # ── 文章操作 ──────────────────────────────────────────────────

    def article_exists(self, source_url: str) -> bool:
        """根據 source_url 檢查文章是否已存在於資料庫中。"""
        try:
            rows = self._query(
                "SELECT 1 FROM articles WHERE source_url = %s LIMIT 1", (source_url,)
            )
            return len(rows) > 0
        except psycopg.Error as exc:
            logger.error("檢查文章是否存在時發生錯誤: %s", exc)
            return False

    def slug_exists(self, slug: str) -> bool:
        """檢查 slug 是否已被使用。"""
        try:
            rows = self._query("SELECT 1 FROM articles WHERE slug = %s LIMIT 1", (slug,))
            return len(rows) > 0
        except psycopg.Error as exc:
            logger.error("檢查 slug 是否存在時發生錯誤: %s", exc)
            return False

    def insert_article(self, article_data: dict) -> Optional[dict]:
        """
        插入一篇新文章。
        回傳插入後的資料列（含資料庫自動生成欄位），失敗時回傳 None。
        """
        try:
            row = self._insert("articles", article_data, _ARTICLE_COLUMNS)
            if row:
                logger.info(
                    "文章已儲存：%s", article_data.get("translated_title", "")[:60]
                )
            return row
        except psycopg.Error as exc:
            logger.error(
                "插入文章失敗 [%s]: %s", article_data.get("source_url", ""), exc
            )
            return None

    def get_articles(
        self,
        page: int = 1,
        per_page: int = 20,
        tag: Optional[str] = None,
    ) -> dict:
        """
        取得分頁後的已發布文章列表，可依 tag 篩選。
        回傳 {"articles": [...], "total": int}。
        """
        where = "is_published = TRUE"
        params: list = []
        if tag:
            where += " AND tags @> %s"
            params.append([tag])

        try:
            total = self._query(f"SELECT count(*) AS n FROM articles WHERE {where}", params)
            articles = self._query(
                f"SELECT * FROM articles WHERE {where} "
                "ORDER BY created_at DESC LIMIT %s OFFSET %s",
                [*params, per_page, (page - 1) * per_page],
            )
            return {"articles": articles, "total": total[0]["n"] if total else 0}
        except psycopg.Error as exc:
            logger.error("查詢文章列表失敗: %s", exc)
            return {"articles": [], "total": 0}

    def get_article_by_slug(self, slug: str) -> Optional[dict]:
        """根據 slug 取得單篇已發布文章。"""
        try:
            rows = self._query(
                "SELECT * FROM articles WHERE slug = %s AND is_published = TRUE LIMIT 1",
                (slug,),
            )
            return rows[0] if rows else None
        except psycopg.Error as exc:
            logger.debug("查詢文章 [%s] 失敗: %s", slug, exc)
            return None

    def get_all_slugs(self) -> List[dict]:
        """取得所有已發布文章的 slug 與 created_at（供 SSG 使用）。"""
        try:
            return self._query(
                "SELECT slug, created_at FROM articles "
                "WHERE is_published = TRUE ORDER BY created_at DESC"
            )
        except psycopg.Error as exc:
            logger.error("取得 slug 列表失敗: %s", exc)
            return []

    def get_articles_for_ai_highlights_backfill(
        self,
        limit: int = 20,
        offset: int = 0,
        refresh_all: bool = False,
    ) -> List[dict]:
        """取得可用於 ai_highlights 回填的文章資料。"""
        candidates: List[dict] = []
        cursor = offset
        window_size = max(limit * 3, limit, 9)

        while len(candidates) < limit:
            try:
                articles = self._query(
                    "SELECT * FROM articles WHERE is_published = TRUE "
                    "ORDER BY created_at DESC, id LIMIT %s OFFSET %s",
                    (window_size, cursor),
                )
            except psycopg.Error as exc:
                logger.error("取得 ai_highlights 待補文章失敗: %s", exc)
                return candidates

            if not articles:
                break

            if refresh_all:
                candidates.extend(articles)
            else:
                for article in articles:
                    highlights = article.get("ai_highlights")
                    if not isinstance(highlights, list) or len(highlights) < 2:
                        candidates.append(article)
                        continue

                    invalid_items = [
                        item
                        for item in highlights
                        if not isinstance(item, dict)
                        or not str(item.get("point") or "").strip()
                        or not str(item.get("reason") or "").strip()
                        or str(item.get("reason") or "").strip()
                        == _GENERIC_AI_HIGHLIGHT_REASON
                    ]
                    if invalid_items:
                        candidates.append(article)

                    if len(candidates) >= limit:
                        break

            if len(articles) < window_size:
                break

            cursor += window_size

        return candidates[:limit]

    def update_article_ai_highlights(
        self,
        article_id: str,
        ai_highlights: list[dict],
        model_name: Optional[str] = None,
    ) -> bool:
        """更新單篇文章的 ai_highlights。"""
        assignments = "ai_highlights = %s"
        params: list = [Jsonb(ai_highlights, dumps=_dump_json)]
        if model_name:
            assignments += ", model_name = %s"
            params.append(model_name)
        params.append(article_id)

        try:
            rows = self._query(
                f"UPDATE articles SET {assignments} WHERE id = %s RETURNING id", params
            )
            return bool(rows)
        except psycopg.Error as exc:
            logger.error("更新文章 ai_highlights 失敗 [%s]: %s", article_id, exc)
            return False

    # ── Discovery Reports 操作 ────────────────────────────────────

    def discovery_report_exists(self, topic: str, coverage_date: str) -> bool:
        """檢查指定主題與日期的統整報告是否已存在。"""
        try:
            rows = self._query(
                "SELECT 1 FROM discovery_reports "
                "WHERE topic = %s AND coverage_date = %s LIMIT 1",
                (topic, coverage_date),
            )
            return len(rows) > 0
        except psycopg.Error as exc:
            logger.error("檢查統整報告是否存在時發生錯誤: %s", exc)
            return False

    def insert_discovery_report(self, report_data: dict) -> Optional[dict]:
        """插入一篇多來源新聞統整報告。"""
        try:
            row = self._insert("discovery_reports", report_data, _DISCOVERY_COLUMNS)
            if row:
                logger.info("統整報告已儲存：%s", report_data.get("title", "")[:60])
            return row
        except psycopg.Error as exc:
            logger.error(
                "插入統整報告失敗 [%s]: %s", report_data.get("topic", ""), exc
            )
            return None

    def get_latest_discovery_reports(self, limit: int = 6) -> List[dict]:
        """取得最新已發布的統整報告。"""
        try:
            return self._query(
                "SELECT * FROM discovery_reports WHERE is_published = TRUE "
                "ORDER BY coverage_date DESC, created_at DESC LIMIT %s",
                (limit,),
            )
        except psycopg.Error as exc:
            logger.error("查詢統整報告列表失敗: %s", exc)
            return []

    def get_discovery_report_by_slug(self, slug: str) -> Optional[dict]:
        """根據 slug 取得單篇已發布統整報告。"""
        try:
            rows = self._query(
                "SELECT * FROM discovery_reports "
                "WHERE slug = %s AND is_published = TRUE LIMIT 1",
                (slug,),
            )
            return rows[0] if rows else None
        except psycopg.Error as exc:
            logger.debug("查詢統整報告 [%s] 失敗: %s", slug, exc)
            return None

    def get_all_discovery_slugs(self) -> List[dict]:
        """取得所有已發布統整報告 slug 與 updated_at（供 SSG / sitemap 使用）。"""
        try:
            return self._query(
                "SELECT slug, updated_at FROM discovery_reports "
                "WHERE is_published = TRUE ORDER BY coverage_date DESC"
            )
        except psycopg.Error as exc:
            logger.error("取得統整報告 slug 列表失敗: %s", exc)
            return []
