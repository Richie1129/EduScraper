-- =============================================
-- EduScraper 資料庫初始化腳本
-- 請在 Supabase SQL Editor 中執行此腳本
-- =============================================

-- 啟用 UUID 擴充功能
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 文章主表
CREATE TABLE IF NOT EXISTS articles (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug                TEXT UNIQUE NOT NULL,
  original_title      TEXT NOT NULL,
  translated_title    TEXT,
  source_url          TEXT UNIQUE NOT NULL,
  source_name         TEXT,
  authors             TEXT[]        DEFAULT '{}',
  original_abstract   TEXT,
  one_sentence_summary TEXT,
  key_findings        JSONB         DEFAULT '[]',
  practical_insights  TEXT,
  tags                TEXT[]        DEFAULT '{}',
  relevance_score     SMALLINT      DEFAULT 5,
  published_at        TIMESTAMPTZ,
  processed_at        TIMESTAMPTZ   DEFAULT NOW(),
  created_at          TIMESTAMPTZ   DEFAULT NOW(),
  is_published        BOOLEAN       DEFAULT TRUE
);

-- 效能索引
CREATE INDEX IF NOT EXISTS idx_articles_slug         ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_tags         ON articles USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_articles_is_published ON articles(is_published);
CREATE INDEX IF NOT EXISTS idx_articles_relevance    ON articles(relevance_score DESC);

-- 電子報訂閱者表
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  is_active     BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email);

-- =============================================
-- Row Level Security (RLS) 設定
-- =============================================

-- articles 表：允許公開讀取已發布文章
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read published articles"
  ON articles FOR SELECT
  USING (is_published = TRUE);

-- 僅允許 service role 寫入
CREATE POLICY "Service role full access on articles"
  ON articles FOR ALL
  USING (auth.role() = 'service_role');

-- newsletter_subscribers 表
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on newsletter"
  ON newsletter_subscribers FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================
-- 範例資料（可選，用於測試）
-- =============================================
-- INSERT INTO articles (slug, original_title, translated_title, source_url, one_sentence_summary, tags, published_at)
-- VALUES (
--   'test-article-001',
--   'Test Article: Self-Regulated Learning in Online Environments',
--   '測試文章：線上環境中的自主學習策略研究',
--   'https://example.com/test-article',
--   '本研究探討線上學習環境中自主學習策略對學習成效的影響。',
--   ARRAY['SRL', 'online learning', 'education'],
--   NOW()
-- );
