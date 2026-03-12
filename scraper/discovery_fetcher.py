"""多來源新聞統整的搜尋與內容擷取模組。"""

import logging
import os
from datetime import datetime, timezone
from urllib.parse import quote, urlparse

import requests
from dateutil import parser as date_parser

logger = logging.getLogger(__name__)


def _normalize_domain(url: str) -> str:
    parsed = urlparse(url)
    return parsed.netloc.replace("www.", "")


def _compact_text(text: str, limit: int) -> str:
    collapsed = " ".join((text or "").split())
    if len(collapsed) <= limit:
        return collapsed
    return f"{collapsed[: limit - 1].rstrip()}…"


class DiscoveryFetcher:
    """使用搜尋 API 與 Jina Reader 擷取可供 LLM 彙整的來源內容。"""

    def __init__(self):
        self.tavily_api_key = os.getenv("TAVILY_API_KEY")
        self.serpapi_api_key = os.getenv("SERPAPI_API_KEY")
        self.timeout = float(os.getenv("DISCOVERY_HTTP_TIMEOUT", "20"))
        self.max_age_days = int(os.getenv("DISCOVERY_MAX_AGE_DAYS", "30"))
        self.allow_undated_sources = (
            os.getenv("DISCOVERY_ALLOW_UNDATED_SOURCES", "false").lower() == "true"
        )

        if not self.tavily_api_key and not self.serpapi_api_key:
            raise ValueError(
                "請設定 TAVILY_API_KEY，或設定 SERPAPI_API_KEY 以搭配 Jina Reader 使用 discovery pipeline"
            )

    def discover(
        self,
        query: str,
        max_results: int = 5,
        coverage_date: str | None = None,
    ) -> list[dict]:
        """依查詢字串回傳去重後的來源清單。"""
        reference_date = (
            datetime.fromisoformat(coverage_date).date()
            if coverage_date
            else datetime.now(timezone.utc).date()
        )
        raw_results = (
            self._search_with_tavily(query, max_results)
            if self.tavily_api_key
            else self._search_with_serpapi(query, max_results)
        )

        fresh_sources: list[dict] = []
        fallback_sources: list[dict] = []
        seen_urls: set[str] = set()

        for item in raw_results:
            url = (item.get("url") or "").strip()
            if not url or url in seen_urls:
                continue

            is_fresh, parsed_published_at = self._is_fresh_result(
                item.get("published_date"), reference_date
            )
            if not is_fresh:
                logger.info("來源日期過舊，略過：%s | %s", item.get("published_date"), url)
                continue

            source = self._build_source(
                item,
                len(fresh_sources) + len(fallback_sources) + 1,
                parsed_published_at,
            )
            if not source:
                continue

            seen_urls.add(url)

            if source["published_at"] is None:
                fallback_sources.append(source)
            else:
                fresh_sources.append(source)

        if len(fresh_sources) >= max_results:
            return fresh_sources[:max_results]

        if self.allow_undated_sources:
            combined = fresh_sources + fallback_sources
            return combined[:max_results]

        return fresh_sources[:max_results]

    def _search_with_tavily(self, query: str, max_results: int) -> list[dict]:
        response = requests.post(
            "https://api.tavily.com/search",
            json={
                "api_key": self.tavily_api_key,
                "query": query,
                "topic": "news",
                "search_depth": "advanced",
                "max_results": max_results,
                "include_raw_content": True,
            },
            timeout=self.timeout,
        )
        response.raise_for_status()
        payload = response.json()
        return payload.get("results", [])

    def _search_with_serpapi(self, query: str, max_results: int) -> list[dict]:
        response = requests.get(
            "https://serpapi.com/search.json",
            params={
                "engine": "google",
                "q": query,
                "api_key": self.serpapi_api_key,
                "num": max_results,
                "tbs": f"qdr:d{self.max_age_days}",
            },
            timeout=self.timeout,
        )
        response.raise_for_status()
        payload = response.json()
        results = payload.get("organic_results", [])
        return [
            {
                "url": item.get("link"),
                "title": item.get("title"),
                "content": item.get("snippet", ""),
                "raw_content": "",
                "published_date": item.get("date"),
            }
            for item in results
        ]

    def _build_source(
        self,
        item: dict,
        source_id: int,
        parsed_published_at: datetime | None,
    ) -> dict | None:
        url = (item.get("url") or "").strip()
        title = (item.get("title") or url).strip()
        excerpt = _compact_text(item.get("content") or "", 260)
        raw_content = item.get("raw_content") or ""
        content = _compact_text(raw_content, 3200)

        if len(content) < 500:
            content = self._fetch_via_jina(url)

        if len(content) < 300:
            logger.warning("來源內容不足，跳過：%s", url)
            return None

        domain = _normalize_domain(url)
        return {
            "id": source_id,
            "url": url,
            "title": title,
            "source_name": domain,
            "domain": domain,
            "excerpt": excerpt or _compact_text(content, 220),
            "content": content,
            "published_at": (
                parsed_published_at.astimezone(timezone.utc).isoformat()
                if parsed_published_at
                else None
            ),
            "favicon_url": f"https://www.google.com/s2/favicons?domain={quote(domain)}&sz=64",
        }

    def _is_fresh_result(
        self,
        published_value: str | None,
        reference_date,
    ) -> tuple[bool, datetime | None]:
        if not published_value:
            return self.allow_undated_sources, None

        try:
            parsed = date_parser.parse(published_value)
        except (ValueError, TypeError, OverflowError):
            logger.info("無法解析來源日期，略過：%s", published_value)
            return self.allow_undated_sources, None

        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)

        parsed_date = parsed.astimezone(timezone.utc).date()
        age_days = (reference_date - parsed_date).days

        if parsed_date.year != reference_date.year:
            return False, parsed

        if age_days < 0:
            return False, parsed

        if age_days > self.max_age_days:
            return False, parsed

        return True, parsed

    def _fetch_via_jina(self, url: str) -> str:
        stripped_url = url.replace("https://", "").replace("http://", "")
        response = requests.get(
            f"https://r.jina.ai/http://{stripped_url}",
            timeout=self.timeout,
            headers={"X-Return-Format": "markdown"},
        )
        response.raise_for_status()
        return _compact_text(response.text, 3200)