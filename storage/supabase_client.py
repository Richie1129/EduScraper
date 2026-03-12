"""
Supabase 資料庫操作模組
提供文章的 CRUD 操作，後端管線使用 service_role 金鑰以繞過 RLS。
"""

import logging
import os
from typing import List, Optional

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

logger = logging.getLogger(__name__)


class SupabaseStorage:
    """封裝 Supabase 的文章與訂閱者資料表操作。"""

    def __init__(self):
        url = os.getenv("SUPABASE_URL")
        # 後端管線需要 service_role 金鑰以進行寫入操作
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

        if not url or not key:
            raise ValueError(
                "請在 .env 中設定 SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY"
            )

        self.client: Client = create_client(url, key)
        logger.info("Supabase 連線初始化完成")

    # ── 文章操作 ──────────────────────────────────────────────────

    def article_exists(self, source_url: str) -> bool:
        """根據 source_url 檢查文章是否已存在於資料庫中。"""
        try:
            response = (
                self.client.table("articles")
                .select("id")
                .eq("source_url", source_url)
                .limit(1)
                .execute()
            )
            return len(response.data) > 0
        except Exception as exc:
            logger.error("檢查文章是否存在時發生錯誤: %s", exc)
            return False

    def slug_exists(self, slug: str) -> bool:
        """檢查 slug 是否已被使用。"""
        try:
            response = (
                self.client.table("articles")
                .select("id")
                .eq("slug", slug)
                .limit(1)
                .execute()
            )
            return len(response.data) > 0
        except Exception as exc:
            logger.error("檢查 slug 是否存在時發生錯誤: %s", exc)
            return False

    def insert_article(self, article_data: dict) -> Optional[dict]:
        """
        插入一篇新文章。
        回傳插入後的資料列（含資料庫自動生成欄位），失敗時回傳 None。
        """
        try:
            response = self.client.table("articles").insert(article_data).execute()
            if response.data:
                logger.info(
                    "文章已儲存：%s", article_data.get("translated_title", "")[:60]
                )
                return response.data[0]
            return None
        except Exception as exc:
            logger.error(
                "插入文章失敗 [%s]: %s",
                article_data.get("source_url", ""),
                exc,
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
        try:
            query = (
                self.client.table("articles")
                .select("*", count="exact")
                .eq("is_published", True)
                .order("created_at", desc=True)
            )

            if tag:
                query = query.contains("tags", [tag])

            offset = (page - 1) * per_page
            response = query.range(offset, offset + per_page - 1).execute()

            return {
                "articles": response.data or [],
                "total": response.count or 0,
            }
        except Exception as exc:
            logger.error("查詢文章列表失敗: %s", exc)
            return {"articles": [], "total": 0}

    def get_article_by_slug(self, slug: str) -> Optional[dict]:
        """根據 slug 取得單篇已發布文章。"""
        try:
            response = (
                self.client.table("articles")
                .select("*")
                .eq("slug", slug)
                .eq("is_published", True)
                .single()
                .execute()
            )
            return response.data
        except Exception as exc:
            logger.debug("查詢文章 [%s] 失敗: %s", slug, exc)
            return None

    def get_all_slugs(self) -> List[dict]:
        """取得所有已發布文章的 slug 與 created_at（供 SSG 使用）。"""
        try:
            response = (
                self.client.table("articles")
                .select("slug, created_at")
                .eq("is_published", True)
                .order("created_at", desc=True)
                .execute()
            )
            return response.data or []
        except Exception as exc:
            logger.error("取得 slug 列表失敗: %s", exc)
            return []

    # ── Discovery Reports 操作 ────────────────────────────────────

    def discovery_report_exists(self, topic: str, coverage_date: str) -> bool:
        """檢查指定主題與日期的統整報告是否已存在。"""
        try:
            response = (
                self.client.table("discovery_reports")
                .select("id")
                .eq("topic", topic)
                .eq("coverage_date", coverage_date)
                .limit(1)
                .execute()
            )
            return len(response.data) > 0
        except Exception as exc:
            logger.error("檢查統整報告是否存在時發生錯誤: %s", exc)
            return False

    def insert_discovery_report(self, report_data: dict) -> Optional[dict]:
        """插入一篇多來源新聞統整報告。"""
        try:
            response = (
                self.client.table("discovery_reports").insert(report_data).execute()
            )
            if response.data:
                logger.info("統整報告已儲存：%s", report_data.get("title", "")[:60])
                return response.data[0]
            return None
        except Exception as exc:
            logger.error(
                "插入統整報告失敗 [%s]: %s",
                report_data.get("topic", ""),
                exc,
            )
            return None

    def get_latest_discovery_reports(self, limit: int = 6) -> List[dict]:
        """取得最新已發布的統整報告。"""
        try:
            response = (
                self.client.table("discovery_reports")
                .select("*")
                .eq("is_published", True)
                .order("coverage_date", desc=True)
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            return response.data or []
        except Exception as exc:
            logger.error("查詢統整報告列表失敗: %s", exc)
            return []

    def get_discovery_report_by_slug(self, slug: str) -> Optional[dict]:
        """根據 slug 取得單篇已發布統整報告。"""
        try:
            response = (
                self.client.table("discovery_reports")
                .select("*")
                .eq("slug", slug)
                .eq("is_published", True)
                .single()
                .execute()
            )
            return response.data
        except Exception as exc:
            logger.debug("查詢統整報告 [%s] 失敗: %s", slug, exc)
            return None

    def get_all_discovery_slugs(self) -> List[dict]:
        """取得所有已發布統整報告 slug 與 updated_at（供 SSG / sitemap 使用）。"""
        try:
            response = (
                self.client.table("discovery_reports")
                .select("slug, updated_at")
                .eq("is_published", True)
                .order("coverage_date", desc=True)
                .execute()
            )
            return response.data or []
        except Exception as exc:
            logger.error("取得統整報告 slug 列表失敗: %s", exc)
            return []
