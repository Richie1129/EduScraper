# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

EduScraper 是一套全自動教育科技研究策展系統，由兩個獨立部分組成：
- **Python 後端管線**：抓取 RSS/爬蟲 → vLLM AI 翻譯摘要 → 寫入 Supabase
- **Next.js 14 前端**：從 Supabase 讀取資料，以 ISR/SSG 呈現繁體中文文章

## 常用指令

### Python 後端管線

```bash
# 啟動虛擬環境
source .venv/bin/activate

# 執行管線（預設最多 50 篇）
python -m pipeline.main

# 指定篇數上限
python -m pipeline.main --limit 5

# 使用備用 vLLM 伺服器
python -m pipeline.main --use-backup-vllm

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

## 架構說明

### 資料流

```
RSS/爬蟲來源 (scraper/)
    → rss_fetcher.py 抓取全部 feed
    → pipeline/main.py 過濾已存在文章（以 source_url 去重）
    → processor/ai_processor.py 呼叫 vLLM（OpenAI-compatible API）
    → 相關度分數 < RELEVANCE_SCORE_THRESHOLD 則跳過
    → storage/supabase_client.py 使用 service_role 金鑰寫入 Supabase
    → Next.js ISR (revalidate=3600) 自動更新頁面
```

### Python 後端模組

- `scraper/sources.py`：定義 `RSS_SOURCES` 列表，每個來源含 `name`、`url`、`category`、`tags`、`use_playwright` 欄位
- `scraper/rss_fetcher.py`：用 feedparser 批次抓取所有 feed
- `scraper/web_scraper.py`：BeautifulSoup / Playwright 靜態與動態爬蟲
- `processor/prompts.py`：vLLM system prompt 與 user prompt 模板（要求輸出 JSON）
- `processor/ai_processor.py`：`VLLMProcessor` 類別，支援主要/備用伺服器切換，最多重試 3 次，自動解析非標準 JSON
- `storage/supabase_client.py`：`SupabaseStorage` 類別，封裝 articles 與 newsletter_subscribers 表的 CRUD
- `pipeline/main.py`：主協調程式，`run_pipeline()` 串接以上三層；`generate_slug()` 以原始標題 + source_url MD5 雜湊生成唯一 slug
- `scheduler.py`：純 Python 排程器（Docker 容器內使用），每天 UTC 18:00 執行 pipeline

### Next.js 前端

- `frontend/src/lib/supabase.ts`：懶惰初始化 Supabase 客戶端，提供 `getArticles`、`getArticleBySlug`、`getAllSlugs`
- `frontend/src/app/page.tsx`：首頁，ISR `revalidate=3600`，支援分頁與 tag 篩選
- `frontend/src/app/articles/[slug]/page.tsx`：文章詳情頁，ISR `revalidate=86400`
- `frontend/src/app/api/newsletter/route.ts`：電子報訂閱 API Route（需 `SUPABASE_SERVICE_ROLE_KEY`）
- `frontend/src/components/AdSense.tsx`：Google AdSense 廣告元件

### 資料庫結構（Supabase PostgreSQL）

`articles` 表主要欄位：`slug`（唯一）、`original_title`、`translated_title`、`source_url`（唯一）、`key_findings`（JSONB 陣列）、`tags`（TEXT[]，有 GIN 索引）、`relevance_score`、`is_published`

RLS 設定：匿名使用者只能讀取 `is_published=true` 的文章；寫入需 service_role 金鑰。

## 環境變數

### Python 管線（`.env`）
- `VLLM_BASE_URL`、`VLLM_MODEL_NAME`、`VLLM_API_KEY`：主要 vLLM 伺服器
- `HSUEH_VLLM_BASE_URL`、`HSUEH_VLLM_MODEL_NAME`、`HSUEH_VLLM_API_KEY`：備用伺服器
- `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`：Supabase 連線（寫入需 service_role）
- `RELEVANCE_SCORE_THRESHOLD`：AI 相關度門檻，預設 5（1–10）
- `MAX_ARTICLES_PER_RUN`：每次執行上限，預設 50

### 前端（`frontend/.env.local`）
- `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`：前端讀取用
- `SUPABASE_SERVICE_ROLE_KEY`：電子報 API Route 專用，僅伺服器端使用
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
