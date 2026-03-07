"""
資料來源設定
定義所有 RSS Feed 訂閱來源，聚焦於教育科技、自主學習（SRL）、專題式學習（PBL）領域。
"""

RSS_SOURCES = [
    # ── arXiv 學術預印本 ─────────────────────────────────────────
    {
        "name": "arXiv - Computers and Society",
        "url": "https://arxiv.org/rss/cs.CY",
        "category": "academic",
        "tags": ["AI", "technology", "society", "education"],
        "use_playwright": False,
    },
    {
        "name": "arXiv - Human-Computer Interaction",
        "url": "https://arxiv.org/rss/cs.HC",
        "category": "academic",
        "tags": ["HCI", "interaction", "education", "learning"],
        "use_playwright": False,
    },
    {
        "name": "arXiv - Artificial Intelligence",
        "url": "https://arxiv.org/rss/cs.AI",
        "category": "academic",
        "tags": ["AI", "machine learning", "education"],
        "use_playwright": False,
    },
    # ── 教育科技新聞媒體 ──────────────────────────────────────────
    {
        "name": "EdSurge",
        "url": "https://www.edsurge.com/rss/feed",
        "category": "news",
        "tags": ["edtech", "education", "innovation"],
        "use_playwright": False,
    },
    {
        "name": "EdTech Magazine - Higher Ed",
        "url": "https://edtechmagazine.com/higher/rss.xml",
        "category": "magazine",
        "tags": ["edtech", "higher education", "tools"],
        "use_playwright": False,
    },
    {
        "name": "Inside Higher Ed",
        "url": "https://www.insidehighered.com/rss/feed",
        "category": "news",
        "tags": ["higher education", "policy", "research"],
        "use_playwright": False,
    },
    {
        "name": "THE - Times Higher Education",
        "url": "https://www.timeshighereducation.com/feeds/news",
        "category": "news",
        "tags": ["higher education", "research", "global"],
        "use_playwright": False,
    },
    # ── 學習科學與教學設計 ────────────────────────────────────────
    {
        "name": "Learning Scientists Blog",
        "url": "https://www.learningscientists.org/blog?format=rss",
        "category": "blog",
        "tags": ["cognitive science", "learning", "SRL", "study strategies"],
        "use_playwright": False,
    },
    {
        "name": "e-Learning Industry",
        "url": "https://elearningindustry.com/feed",
        "category": "blog",
        "tags": ["eLearning", "instructional design", "edtech", "PBL"],
        "use_playwright": False,
    },
    # ── 教育研究 ─────────────────────────────────────────────────
    {
        "name": "NBER - Education Working Papers",
        "url": "https://www.nber.org/rss/new_releases_rss.xml",
        "category": "academic",
        "tags": ["education economics", "research", "policy"],
        "use_playwright": False,
    },
    {
        "name": "Brookings Education",
        "url": "https://www.brookings.edu/topic/education/feed/",
        "category": "think_tank",
        "tags": ["education policy", "research", "evidence-based"],
        "use_playwright": False,
    },
]

# 不含 RSS，需要直接爬取的補充來源（可依需求啟用）
SCRAPE_SOURCES = [
    {
        "name": "ERIC - Education Resources Information Center",
        "url": "https://eric.ed.gov/?q=self-regulated+learning&sort=r&pg=1",
        "category": "database",
        "tags": ["SRL", "education research", "ERIC"],
        "use_playwright": True,
    },
]
