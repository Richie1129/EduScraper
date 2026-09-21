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
PostgreSQL（持久化儲存）
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
│   ├── prompts.py             # vLLM Prompt 模板
│   ├── ai_processor.py        # 單篇文章摘要處理器
│   └── discovery_processor.py # 多來源統整處理器
├── storage/
│   └── postgres_client.py  # PostgreSQL CRUD 操作（psycopg）
├── pipeline/
│   ├── main.py             # 單篇文章主管線
│   └── discovery.py        # 每日新聞統整管線
├── frontend/               # Next.js 14 前端
│   └── src/
│       ├── app/            # App Router 頁面
│       ├── components/     # UI 元件
│       ├── lib/            # PostgreSQL 連線池與查詢（db.ts）
│       └── types/          # TypeScript 型別
├── db/schema.sql           # PostgreSQL schema（可重複執行）
├── deploy/                 # Proxmox VM 部署（compose + 部署腳本）
├── Dockerfile              # 容器化管線
├── docker-compose.yml
├── crontab.txt             # 排程設定
├── requirements.txt
├── .env                    # 環境變數（勿提交）
└── .env.example
```

## 快速開始

### 一、設定 PostgreSQL

```bash
# 啟動本機資料庫（或使用任何 PostgreSQL 14+）
docker run -d --name eduscraper-pg -e POSTGRES_USER=eduscraper -e POSTGRES_PASSWORD=devpw \
  -e POSTGRES_DB=eduscraper -p 127.0.0.1:5432:5432 postgres:17-alpine

# 建立資料表、索引與搜尋函式（可重複執行）
docker exec -i eduscraper-pg psql -U eduscraper -d eduscraper -v ON_ERROR_STOP=1 < db/schema.sql
```

連線字串：`postgresql://eduscraper:devpw@127.0.0.1:5432/eduscraper`（設為 `DATABASE_URL`）

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
# 編輯 .env，填入 DATABASE_URL 與其他金鑰

# 5. 手動執行一次管線測試
python -m pipeline.main --limit 5

# 6. 手動執行一次 discovery 引擎
python -m pipeline.discovery

# 7. 查看說明
python -m pipeline.main --help
```

### 三、Next.js 前端

```bash
cd frontend

# 1. 安裝依賴
npm install

# 2. 設定環境變數
cp .env.local.example .env.local
# 編輯 .env.local，填入 DATABASE_URL 與網站 URL

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

# 單獨觸發 discovery pipeline
docker-compose exec pipeline python -m pipeline.discovery
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
| `DATABASE_URL` | PostgreSQL 連線字串 | ✅ |
| `RELEVANCE_SCORE_THRESHOLD` | AI 相關度門檻（1–10，預設 5） | |
| `MAX_ARTICLES_PER_RUN` | 每次最多處理篇數（預設 50） | |
| `TAVILY_API_KEY` | Tavily 搜尋與內容擷取 API 金鑰 | discovery 建議必填 |
| `SERPAPI_API_KEY` | SERP API 金鑰，搭配 Jina Reader 使用 | discovery 備援 |
| `DISCOVERY_TOPICS` | discovery 主題清單，以逗號分隔 | |
| `DISCOVERY_QUERY_TEMPLATE` | discovery 搜尋模板，支援 `{topic}`、`{coverage_date}` | |
| `DISCOVERY_MAX_SOURCES_PER_TOPIC` | 每個主題最多整合來源數，預設 5 | |
| `DISCOVERY_MAX_AGE_DAYS` | discovery 只保留幾天內新聞，預設 30 | |
| `DISCOVERY_ALLOW_UNDATED_SOURCES` | 是否允許沒有日期的來源，預設 `false` | |
| `USE_HSUEH_VLLM` | 使用備用伺服器（`true`/`false`） | |

### 前端 (`frontend/.env.local`)

| 變數名 | 說明 | 必填 |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 連線字串（僅伺服器端使用） | ✅ |
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
    "ai_highlights": [
        {
            "point": "AI 判斷最值得先讀的重點",
            "reason": "AI 為何覺得它重要，會顯示在文章 hover 提示中"
        }
  ],
  "practical_insights": "對教育工作者的具體啟發（100字以內）",
  "tags": ["SRL", "metacognition", "K-12"],
  "relevance_score": 8
}
```

相關度分數 < `RELEVANCE_SCORE_THRESHOLD`（預設 5）的文章會自動跳過，確保只有高品質的教育科技相關內容進入資料庫。

### Discovery 引擎

`pipeline.discovery` 會依據 `DISCOVERY_TOPICS` 逐一搜尋新聞來源，優先使用 Tavily API；若未提供 Tavily，則改走 `SERPAPI_API_KEY + Jina Reader` 的組合。每個主題會產生一篇帶引用標註的 Markdown 統整文章，並連同參考文獻 JSON 寫入 `discovery_reports`。

為避免混入舊新聞，discovery 現在有兩層新鮮度限制：
- 搜尋查詢會帶入 `coverage_date`
- 程式會再用 `DISCOVERY_MAX_AGE_DAYS` 做日期過濾，且預設拒絕跨年份與無日期來源

資料表核心欄位：
- `markdown_content`：完整 Markdown 報導內容，句句帶來源標註如 `[1]`
- `source_references`：來源陣列，包含標題、網址、摘錄、favicon 與原始內容節錄
- `coverage_date`：該篇統整覆蓋日期
- `topic`：該篇統整主題

### Schema 變更

`db/schema.sql` 全部使用 `IF NOT EXISTS` / `CREATE OR REPLACE`，可重複執行；新增欄位時直接改此檔並加入 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`。`setup_db.sql`、`search_migration.sql`、`ai_highlights_migration.sql` 為 Supabase 時期的舊腳本，已由 `db/schema.sql` 取代。

### 前端建構權限注意

若曾用 `sudo`、root 容器或其他高權限帳號在 `frontend/` 執行 `next build`，可能會留下 root 擁有的 `.next` 產物，之後本機 build 會出現 `EACCES: permission denied, unlink ...`。

建議處理方式：
- 直接移走舊的 `.next` 目錄後重新 build
- 或將 `.next` 目錄 ownership 改回目前使用者
- 後續避免用 root 身分在本機直接執行前端 build

---

## 變現策略

### 1. Google AdSense
在 `frontend/.env.local` 設定 `NEXT_PUBLIC_ADSENSE_ID`，廣告自動顯示在：
- 文章頭部（`AdSense slot="3456789012"`）
- 文章中段（`AdSense slot="4567890123"`）

### 2. 聯盟行銷
在 `frontend/src/app/articles/[slug]/page.tsx` 文章底部加入相關推廣連結（線上課程、教育書籍等）。

### 3. 電子報
訂閱 email 儲存至 PostgreSQL `newsletter_subscribers` 資料表，搭配 [Resend](https://resend.com) 或 [Buttondown](https://buttondown.email) 自動寄送每週精選。

---

## Proxmox VM 部署（GitHub Actions + GHCR + Cloudflare Tunnel）

push 到 `main` 後自動部署：

```
push main → GitHub 雲端建構映像 → ghcr.io/richie1129/eduscraper-app:<commit-sha>
         → VM 上的 self-hosted runner 拉取映像 → 套用 db/schema.sql → 重啟 app → 健康檢查
```

流程定義於 `.github/workflows/deploy.yml`。VM 端只需一次性設定：

```bash
# 在 VM 上安裝本專案專用的 self-hosted runner（token 取自 repo Settings → Actions → Runners）
RUNNER_TOKEN=AXXXX... bash deploy/setup-runner.sh
```

手動部署／回滾／同步機密檔：

```bash
deploy/deploy-vm.sh                      # 部署 ghcr 上的 :main
deploy/deploy-vm.sh --tag <commit-sha>   # 回滾到指定版本
deploy/deploy-vm.sh --env-only           # 只同步 app.env 與 compose 設定，不重啟
```

`app.env` 內的金鑰（vLLM / Resend）不進 GitHub，只能由 `deploy/deploy-vm.sh` 從本機 `.env` 同步。
服務內容、伺服器 `.env` 必要變數與 Cloudflare Public Hostname 設定，見 `deploy/docker-compose.vm.yml` 檔頭與 `deploy/deploy-vm.sh`。資料庫資料存在 Docker volume `eduscraper_pgdata`，請自行規劃備份（`pg_dump`）。

---

## 前端部署（Vercel）

> 前端已改為直接連 PostgreSQL（`pg`），部署到 Vercel 需要一個可從外部連線的資料庫；目前建議使用上方的 VM 部署。

1. 將 `frontend/` 目錄推送至 GitHub 獨立儲存庫（或 monorepo 設定 root 為 `frontend/`）
2. 連結至 Vercel，設定所有環境變數
3. 每次寫入新文章後，ISR（`revalidate = 3600`）會在下次訪問時自動更新首頁；文章詳情頁（`revalidate = 86400`）每日重建一次

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

- `DATABASE_URL` 絕對不可暴露在前端（不可加 `NEXT_PUBLIC_` 前綴），僅用於伺服器端
- 資料庫不對外開放（僅 Docker 內部網路與 127.0.0.1），前端查詢一律在伺服器端執行並過濾 `is_published=true`
- 電子報 API 對 email 格式進行正則驗證，防止無效輸入
- Next.js 設有 `X-Frame-Options: DENY`、`X-Content-Type-Options: nosniff` 等安全 Header
