"""
RSS Feed 抓取模組
使用 feedparser 訂閱並解析學術期刊與教育科技媒體的 RSS/Atom Feed。
"""

import time
import logging
from typing import List, Dict, Optional

import feedparser
from bs4 import BeautifulSoup
from dateutil import parser as dateparser

logger = logging.getLogger(__name__)


def fetch_rss_feed(source: Dict) -> List[Dict]:
    """從單一 RSS 來源抓取文章列表。"""
    articles = []
    source_name = source.get("name", "Unknown")

    try:
        feed = feedparser.parse(source["url"])

        if feed.bozo and feed.bozo_exception:
            logger.warning(
                "Feed 解析警告 [%s]: %s", source_name, feed.bozo_exception
            )

        if not feed.entries:
            logger.info("來源 [%s] 沒有新文章", source_name)
            return articles

        for entry in feed.entries:
            title = entry.get("title", "").strip()
            url = entry.get("link", "").strip()

            if not title or not url:
                continue

            article = {
                "original_title": title,
                "source_url": url,
                "source_name": source_name,
                "original_abstract": _extract_abstract(entry),
                "authors": _extract_authors(entry),
                "published_at": _parse_date(entry),
                "tags": list(source.get("tags", [])),
            }
            articles.append(article)

        logger.info("來源 [%s] 抓取到 %d 篇文章", source_name, len(articles))

    except Exception as exc:
        logger.error("抓取來源 [%s] 失敗: %s", source_name, exc, exc_info=True)

    return articles


def fetch_all_feeds(sources: List[Dict]) -> List[Dict]:
    """從所有 RSS 來源抓取文章，並依 source_url 去重。"""
    all_articles: List[Dict] = []

    for source in sources:
        articles = fetch_rss_feed(source)
        all_articles.extend(articles)
        time.sleep(1)  # 禮貌性延遲，避免對來源伺服器造成壓力

    # 依 source_url 去重
    seen: set = set()
    deduped: List[Dict] = []
    for article in all_articles:
        url = article["source_url"]
        if url not in seen:
            seen.add(url)
            deduped.append(article)

    logger.info(
        "共抓取 %d 篇（去重後 %d 篇）", len(all_articles), len(deduped)
    )
    return deduped


# ── 私有輔助函式 ──────────────────────────────────────────────────

def _extract_abstract(entry) -> str:
    """從 Feed Entry 中提取摘要文字，去除 HTML 標籤。"""
    # 優先使用 content 欄位（通常較完整）
    content_list = entry.get("content", [])
    if isinstance(content_list, list) and content_list:
        raw = content_list[0].get("value", "")
        if raw:
            return _strip_html(raw)[:3000]

    summary = entry.get("summary", "") or entry.get("description", "")
    return _strip_html(summary)[:3000]


def _extract_authors(entry) -> List[str]:
    """從 Feed Entry 中提取作者名單（最多 5 位）。"""
    authors: List[str] = []

    if hasattr(entry, "authors") and entry.authors:
        authors = [
            a.get("name", "").strip()
            for a in entry.authors
            if a.get("name")
        ]
    elif hasattr(entry, "author") and entry.author:
        authors = [entry.author.strip()]
    elif hasattr(entry, "author_detail") and entry.author_detail:
        name = entry.author_detail.get("name", "")
        if name:
            authors = [name.strip()]

    return [a for a in authors if a][:5]


def _parse_date(entry) -> Optional[str]:
    """從 Feed Entry 中解析發布日期，回傳 ISO 8601 字串。"""
    for field in ("published", "updated", "created"):
        date_str = entry.get(field, "")
        if date_str:
            try:
                return dateparser.parse(date_str).isoformat()
            except Exception:
                continue
    return None


def _strip_html(html: str) -> str:
    """移除 HTML 標籤，回傳純文字。"""
    if not html:
        return ""
    try:
        soup = BeautifulSoup(html, "lxml")
        return soup.get_text(separator=" ", strip=True)
    except Exception:
        return html
