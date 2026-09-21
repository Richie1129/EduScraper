# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

EduScraper 是一套全自動教育科技研究策展系統，由兩個獨立部分組成：
- **Python 後端管線**：抓取 RSS/爬蟲 → vLLM AI 翻譯摘要 → 寫入 PostgreSQL
- **Next.js 14 前端**：從 PostgreSQL 讀取資料，以 ISR/SSG 呈現繁體中文文章

## 常用指令

### Python 後端管線

```bash
# 啟動虛擬環境
source .venv/bin/activate

# 執行管線（預設最多 50 篇）
python -m pipeline.main

# 指定篇數上限
python -m pipeline.main --limit 5

# 只跑特定來源（依來源名稱關鍵字，不分大小寫）
python -m pipeline.main --limit 10 --sources arxiv

# 手動啟動排程器（Docker 外使用）
python scheduler.py
```

### Next.js 前端

```bash
cd frontend

# 本地開發
npm run dev          # http://localhost:3000

# 建構與啟動
npm run build && npm start

# Lint 檢查
npm run lint
```

### Docker 部署

```bash
# 建構並背景執行（管線排程每天 UTC 18:00 自動觸發）
docker-compose up -d --build

# 查看管線日誌
docker-compose logs -f pipeline

# 手動觸發管線
docker-compose exec pipeline python -m pipeline.main --limit 20
```

### Proxmox VM 部署（GitHub Actions + GHCR + Cloudflare Tunnel）

push 到 `main` 後自動部署，不需手動操作：

```
push main → GitHub 雲端建構映像 → ghcr.io/richie1129/eduscraper-app:<commit-sha>
         → VM 上的 self-hosted runner 拉取映像 → 套用 schema → 重啟 app → 健康檢查
```

- 流程定義於 `.github/workflows/deploy.yml`；`paths-ignore` 讓純文件變更不觸發部署
- self-hosted runner 裝在 VM 上（標籤 `eduscraper`），安裝見 `deploy/setup-runner.sh`，只需執行一次。
  runner 為 repo 層級，無法與同機 grading / daily-stock-alpha / SDL 的 runner 共用
- **安全性**：本 repo 是 public，workflow 只監聽 push `main` 與手動觸發；
  絕不可加上 `pull_request` 觸發，否則任何人送 PR 都能在 VM 上執行程式碼
- 映像 tag 為 commit SHA，並同時更新 `:main`；部署時寫入伺服器 `.env` 的 `IMAGE_TAG`
- 回滾：`deploy/deploy-vm.sh --tag <commit-sha>`，或在 GitHub 上重跑該 commit 的 workflow

手動部署（GitHub Actions 不可用、回滾、或只同步機密檔時）：

```bash
deploy/deploy-vm.sh                      # 部署 ghcr 上的 :main
deploy/deploy-vm.sh --tag <commit-sha>   # 回滾到指定版本
deploy/deploy-vm.sh --env-only           # 只同步 app.env 與 compose 設定，不重啟
```

- 伺服器目錄：`docker-compose.yml`（來自 `deploy/docker-compose.vm.yml`）、`schema.sql`（來自 `db/schema.sql`）、`app.env`（本機 `.env` 去除 Supabase 變數）、`.env`（compose 變數，人工維護，腳本不覆寫）
- **機密不進 GitHub**：`app.env`（vLLM / Resend 金鑰）只能用 `deploy/deploy-vm.sh --env-only` 從本機 `.env` 同步；新增環境變數後別忘了跑一次
- 服務：`db`（postgres:17-alpine，資料在 volume `eduscraper_pgdata`，僅綁 127.0.0.1:35432）、`app`（Next.js + 排程器，127.0.0.1:3200，映像來自 ghcr）；compose 內的 `cloudflared`（profile `tunnel`）保持停用
- 伺服器 `.env` 需有：`POSTGRES_PASSWORD`、`NEXT_PUBLIC_SITE_URL`、`IMAGE_TAG`（部署流程自動寫入）
- `NEXT_PUBLIC_*` 於建構時內嵌進 Next.js 產物，由 workflow 的 build-args 帶入（取自 repo variables，未設定時用 `https://eduscraper.wuretedu.com`）；改值要重新建構，改伺服器 `.env` 沒有用
- 對外走 VM 上共用的 Cloudflare Tunnel connector（`~/cloudflared/docker-compose.yml`，同時服務同機其他專案），`eduscraper.wuretedu.com` → `http://eduscraper-app:3000` 於 Cloudflare 後台設定；不要在本專案另外啟用 `COMPOSE_PROFILES=tunnel`
- 若 `eduscraper_net` 被 `docker compose down` 重建，需 `cd ~/cloudflared && docker compose up -d --force-recreate` 讓 connector 重新接上（一般 `deploy-vm.sh` 不會重建網路）
- 新網域剛建立時，部分 DNS 解析器（如 8.8.8.8）可能因負快取（TTL 1800 秒）暫時回 NXDOMAIN，約 30 分鐘內自行恢復
- 手動觸發管線（在 VM 上，或 `ssh "$DEPLOY_HOST"`；連線資訊見未進版控的 `deploy/deploy.local.env`）：
  `docker exec eduscraper-app python -m pipeline.main --limit 20`（可加 `--sources arxiv` 只跑特定來源）

## 架構說明

### 資料流

```
RSS/爬蟲來源 (scraper/)
    → rss_fetcher.py 抓取全部 feed
    → pipeline/main.py 過濾已存在文章（以 source_url 去重）
    → processor/ai_processor.py 呼叫 vLLM（OpenAI-compatible API）
    → 相關度分數 < RELEVANCE_SCORE_THRESHOLD 則跳過
    → storage/postgres_client.py 透過 DATABASE_URL 寫入 PostgreSQL
    → Next.js ISR (revalidate=3600) 自動更新頁面
```

### Python 後端模組

- `scraper/sources.py`：定義 `RSS_SOURCES` 列表，每個來源含 `name`、`url`、`category`、`tags`、`use_playwright` 欄位
- `scraper/rss_fetcher.py`：用 feedparser 批次抓取所有 feed
- `scraper/web_scraper.py`：BeautifulSoup / Playwright 靜態與動態爬蟲
- `processor/prompts.py`：vLLM system prompt 與 user prompt 模板（要求輸出 JSON）
- `processor/ai_processor.py`：`VLLMProcessor` 類別，支援主要/備用伺服器切換，最多重試 3 次，自動解析非標準 JSON
- `storage/postgres_client.py`：`PostgresStorage` 類別（psycopg 3），封裝 articles 與 discovery_reports 表的 CRUD；寫入欄位以白名單過濾、JSONB 欄位自動包裝，連線中斷時自動重連
- `pipeline/main.py`：主協調程式，`run_pipeline()` 串接以上三層；`generate_slug()` 以原始標題 + source_url MD5 雜湊生成唯一 slug
- `scheduler.py`：純 Python 排程器（Docker 容器內使用），每天 UTC 18:00 執行 pipeline

### Next.js 前端

- `frontend/src/lib/db.ts`：懶惰初始化 `pg` 連線池（未設定 `DATABASE_URL` 時回傳空結果，建構期可不連資料庫），提供 `getArticles`、`getArticleBySlug`、`getAllSlugs`、`searchArticles` 等；timestamptz 轉 ISO 字串、date 維持 `YYYY-MM-DD`、bigint 轉 number
- `frontend/src/app/page.tsx`：首頁，ISR `revalidate=3600`，支援分頁與 tag 篩選
- `frontend/src/app/articles/[slug]/page.tsx`：文章詳情頁，ISR `revalidate=86400`
- `frontend/src/app/api/newsletter/route.ts`：電子報訂閱 API Route（寫入 `newsletter_subscribers`）
- `frontend/src/components/AdSense.tsx`：Google AdSense 廣告元件

### 資料庫結構（自架 PostgreSQL 17，schema 見 `db/schema.sql`）

`articles` 表主要欄位：`slug`（唯一）、`original_title`、`translated_title`、`source_url`（唯一）、`key_findings`（JSONB 陣列）、`tags`（TEXT[]，有 GIN 索引）、`relevance_score`、`is_published`

存取控制：資料庫不對外開放，只有應用程式以 `DATABASE_URL` 連線；前端查詢一律在伺服器端執行並自行過濾 `is_published=true`。全文搜尋為 `search_articles` / `search_articles_count` 資料庫函式。`db/schema.sql` 可重複執行，schema 變更請直接改此檔（`setup_db.sql` 等舊檔為 Supabase 時期遺留，僅供參考）。

## 環境變數

### Python 管線（`.env`）
- `VLLM_BASE_URL`、`VLLM_MODEL_NAME`、`VLLM_API_KEY`：主要 vLLM 伺服器
- `HSUEH_VLLM_BASE_URL`、`HSUEH_VLLM_MODEL_NAME`、`HSUEH_VLLM_API_KEY`：備用伺服器
- `DATABASE_URL`：PostgreSQL 連線字串，格式 `postgresql://user:password@host:5432/dbname`
- `RELEVANCE_SCORE_THRESHOLD`：AI 相關度門檻，預設 5（1–10）
- `MAX_ARTICLES_PER_RUN`：每次執行上限，預設 50

### 電子報（`.env`）
- `RESEND_API_KEY`：Resend API 金鑰（用於寄送電子報）
- `NEWSLETTER_FROM_EMAIL`：寄件人地址，預設 `EduInsight <newsletter@eduinsight.tw>`
- `NEWSLETTER_SECRET`：觸發寄送 API 的驗證 token

### 前端（`frontend/.env.local`）
- `DATABASE_URL`：PostgreSQL 連線字串，僅伺服器端使用，不可加 `NEXT_PUBLIC_` 前綴
- `NEXT_PUBLIC_SITE_URL`：正式網站 URL（SEO/Sitemap）
- `NEXT_PUBLIC_ADSENSE_ID`：Google AdSense 廣告主 ID

## 可用 Skills 快速參考

| 指令 | 用途 | 何時使用 |
|------|------|----------|
| `/commit` | 繁體中文 commit + push + 驗證 | 每次提交前 |

## Git 規範
- commit 訊息一律使用繁體中文，不使用簡體中文或英文描述（技術術語除外）
- 使用 /commit skill 執行完整的 commit + push + 驗證流程
- push 後必須用 git log --oneline -1 與 git ls-remote origin HEAD 比對 hash，確認遠端已同步

## 圖示與 Emoji 規範

- 禁止在 UI 中使用 emoji（包含按鈕、標籤、標題、提示訊息等）
- 圖示一律使用 `react-icons`，例如 `import { FiUser } from 'react-icons/fi'`
- 需要新圖示時，優先從 react-icons 已有的 icon 集中挑選

## AI Prompt 輸出格式

vLLM 必須回傳標準 JSON，包含：`translated_title`、`one_sentence_summary`、`key_findings`（陣列，最多 3 項）、`practical_insights`、`tags`（小寫字串陣列，最多 5 項）、`relevance_score`（整數 1–10）。
