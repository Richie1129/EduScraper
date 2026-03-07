# EduScraper 📚

> 全自動教育科技研究策展系統——從學術 RSS 訂閱到繁體中文 AI 摘要，再到 SEO 優化網頁的完整資料管線。

## 整體架構

```
來源 (RSS/爬蟲)
    ↓
Python 管線（每日 crontab 自動觸發）
    ↓
vLLM API（翻譯 + 結構化摘要 → JSON）
    ↓
Supabase PostgreSQL（持久化儲存）
    ↓
Next.js ISR/SSG（自動重建頁面）
    ↓
Google 自然搜尋流量 → AdSense / 聯盟行銷 / 電子報
```

## 目錄結構

```
EduScraper/
├── scraper/
│   ├── sources.py          # RSS 訂閱來源定義
│   ├── rss_fetcher.py      # feedparser 抓取模組
│   └── web_scraper.py      # BeautifulSoup / Playwright 爬蟲
├── processor/
│   ├── prompts.py          # vLLM Prompt 模板
│   └── ai_processor.py     # OpenAI 相容 API 呼叫
├── storage/
│   └── supabase_client.py  # Supabase CRUD 操作
├── pipeline/
│   └── main.py             # 主要管線協調
├── frontend/               # Next.js 14 前端
│   └── src/
│       ├── app/            # App Router 頁面
│       ├── components/     # UI 元件
│       ├── lib/            # Supabase 客戶端
│       └── types/          # TypeScript 型別
├── setup_db.sql            # Supabase 資料庫初始化
├── Dockerfile              # 容器化管線
├── docker-compose.yml
├── crontab.txt             # 排程設定
├── requirements.txt
├── .env                    # 環境變數（勿提交）
└── .env.example
```

## 快速開始

### 一、設定 Supabase

1. 至 [supabase.com](https://supabase.com) 建立新專案
2. 在 **SQL Editor** 貼上並執行 `setup_db.sql` 的全部內容
3. 取得專案的 `URL`、`anon key`、`service_role key`

### 二、Python 管線

```bash
# 1. 建立虛擬環境
python -m venv .venv && source .venv/bin/activate

# 2. 安裝依賴
pip install -r requirements.txt

# 3. 安裝 Playwright 瀏覽器（動態爬蟲用）
playwright install chromium

# 4. 複製並填寫環境變數
cp .env.example .env
# 編輯 .env，填入 Supabase URL 與金鑰

# 5. 手動執行一次管線測試
python -m pipeline.main --limit 5

# 6. 查看說明
python -m pipeline.main --help
```

### 三、Next.js 前端

```bash
cd frontend

# 1. 安裝依賴
npm install

# 2. 設定環境變數
cp .env.local.example .env.local
# 編輯 .env.local，填入 Supabase 金鑰與網站 URL

# 3. 本地開發
npm run dev
# 開啟 http://localhost:3000

# 4. 正式建構
npm run build && npm start
```

### 四、Docker 部署（自動化排程）

```bash
# 建構並啟動（管線每天 UTC 18:00 / 台灣 02:00 自動執行）
docker-compose up -d --build

# 查看日誌
docker-compose logs -f pipeline

# 手動觸發一次執行
docker-compose exec pipeline python -m pipeline.main --limit 20
```

---

## 環境變數說明

### Python 管線 (`.env`)

| 變數名 | 說明 | 必填 |
|---|---|---|
| `VLLM_BASE_URL` | vLLM API 伺服器地址 | ✅ |
| `VLLM_MODEL_NAME` | 使用的模型名稱 | ✅ |
| `VLLM_API_KEY` | vLLM API 金鑰 | ✅ |
| `HSUEH_VLLM_BASE_URL` | 備用 vLLM 伺服器地址 | |
| `HSUEH_VLLM_MODEL_NAME` | 備用模型名稱 | |
| `HSUEH_VLLM_API_KEY` | 備用伺服器金鑰 | |
| `SUPABASE_URL` | Supabase 專案 URL | ✅ |
| `SUPABASE_ANON_KEY` | Supabase 匿名金鑰（讀取） | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服務金鑰（寫入） | ✅ |
| `RELEVANCE_SCORE_THRESHOLD` | AI 相關度門檻（1–10，預設 5） | |
| `MAX_ARTICLES_PER_RUN` | 每次最多處理篇數（預設 50） | |
| `USE_HSUEH_VLLM` | 使用備用伺服器（`true`/`false`） | |

### 前端 (`frontend/.env.local`)

| 變數名 | 說明 | 必填 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 專案 URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名金鑰 | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | 服務金鑰（電子報 API 用） | ✅ |
| `NEXT_PUBLIC_ADSENSE_ID` | Google AdSense 廣告主 ID | |
| `NEXT_PUBLIC_SITE_URL` | 正式網站 URL（SEO/Sitemap） | |

---

## AI Prompt 設計

`processor/prompts.py` 中的 Prompt 要求模型輸出標準 JSON：

```json
{
  "translated_title": "繁體中文標題",
  "one_sentence_summary": "一句話核心摘要（50字以內）",
  "key_findings": [
    "核心發現一",
    "核心發現二",
    "核心發現三"
  ],
  "practical_insights": "對教育工作者的具體啟發（100字以內）",
  "tags": ["SRL", "metacognition", "K-12"],
  "relevance_score": 8
}
```

相關度分數 < `RELEVANCE_SCORE_THRESHOLD`（預設 5）的文章會自動跳過，確保只有高品質的教育科技相關內容進入資料庫。

---

## 變現策略

### 1. Google AdSense
在 `frontend/.env.local` 設定 `NEXT_PUBLIC_ADSENSE_ID`，廣告自動顯示在：
- 文章頭部（`AdSense slot="3456789012"`）
- 文章中段（`AdSense slot="4567890123"`）

### 2. 聯盟行銷
在 `frontend/src/app/articles/[slug]/page.tsx` 文章底部加入相關推廣連結（線上課程、教育書籍等）。

### 3. 電子報
訂閱 email 儲存至 Supabase `newsletter_subscribers` 資料表，搭配 [Resend](https://resend.com) 或 [Buttondown](https://buttondown.email) 自動寄送每週精選。

---

## 前端部署（Vercel）

1. 將 `frontend/` 目錄推送至 GitHub 獨立儲存庫（或 monorepo 設定 root 為 `frontend/`）
2. 連結至 Vercel，設定所有環境變數
3. 每次 Supabase 寫入新文章後，ISR（`revalidate = 3600`）會在下次訪問時自動更新首頁；文章詳情頁（`revalidate = 86400`）每日重建一次

---

## 新增 RSS 來源

編輯 `scraper/sources.py`，在 `RSS_SOURCES` 列表中加入：

```python
{
    "name": "你的來源名稱",
    "url": "https://example.com/rss.xml",
    "category": "academic",          # academic / news / blog / magazine
    "tags": ["SRL", "education"],    # 預設標籤
    "use_playwright": False,         # 是否需要 JS 渲染
},
```

---

## 安全性說明

- `SUPABASE_SERVICE_ROLE_KEY` 絕對不可暴露在前端，僅用於伺服器端 API Route
- Supabase RLS 確保公開只能讀取 `is_published=true` 的文章
- 電子報 API 對 email 格式進行正則驗證，防止無效輸入
- Next.js 設有 `X-Frame-Options: DENY`、`X-Content-Type-Options: nosniff` 等安全 Header
