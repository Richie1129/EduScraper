"""
網頁爬蟲模組（靜態 + 動態）
針對沒有提供 RSS 的網站，使用 BeautifulSoup 或 Playwright 抓取內容。
"""

import asyncio
import logging
from typing import Optional

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; EduScraper/1.0; "
        "+https://github.com/your-repo/EduScraper)"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

_CONTENT_SELECTORS = [
    "article",
    "main",
    '[class*="article-body"]',
    '[class*="post-content"]',
    '[class*="entry-content"]',
    '[id*="content"]',
]


def scrape_url(url: str, use_playwright: bool = False) -> Optional[dict]:
    """
    爬取指定 URL 的內容。
    use_playwright=True 時使用 Playwright 處理 JavaScript 渲染的頁面。
    """
    if use_playwright:
        return asyncio.run(_scrape_dynamic(url))
    return _scrape_static(url)


def _scrape_static(url: str) -> Optional[dict]:
    """使用 requests + BeautifulSoup 抓取靜態網頁。"""
    try:
        response = requests.get(url, headers=_HEADERS, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "lxml")

        # 移除雜訊元素
        for tag in soup(["script", "style", "nav", "footer", "aside", "header"]):
            tag.decompose()

        title_tag = soup.find("title")
        title = title_tag.get_text(strip=True) if title_tag else ""

        # 嘗試依序找到主要內容區
        content_elem = None
        for selector in _CONTENT_SELECTORS:
            content_elem = soup.select_one(selector)
            if content_elem:
                break
        if content_elem is None:
            content_elem = soup.find("body")

        abstract = (
            content_elem.get_text(separator=" ", strip=True)[:3000]
            if content_elem
            else ""
        )

        return {
            "original_title": title,
            "source_url": url,
            "original_abstract": abstract,
        }

    except requests.RequestException as exc:
        logger.error("靜態爬取失敗 [%s]: %s", url, exc)
        return None


async def _scrape_dynamic(url: str) -> Optional[dict]:
    """使用 Playwright 爬取 JavaScript 渲染的動態網頁。"""
    try:
        from playwright.async_api import async_playwright  # 延遲匯入

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.set_extra_http_headers(_HEADERS)
            await page.goto(url, wait_until="domcontentloaded", timeout=30_000)
            await page.wait_for_timeout(2_000)

            title = await page.title()

            # 抽取正文文字
            content = await page.evaluate("""() => {
                const noise = document.querySelectorAll(
                    'script, style, nav, footer, aside, header'
                );
                noise.forEach(el => el.remove());
                const main = (
                    document.querySelector('article') ||
                    document.querySelector('main') ||
                    document.querySelector('[class*="content"]') ||
                    document.body
                );
                return main ? main.innerText : document.body.innerText;
            }""")

            await browser.close()

            return {
                "original_title": title,
                "source_url": url,
                "original_abstract": (content or "")[:3000],
            }

    except Exception as exc:
        logger.error("動態爬取失敗 [%s]: %s", url, exc, exc_info=True)
        return None
