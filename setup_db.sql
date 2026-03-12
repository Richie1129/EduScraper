-- =============================================
-- EduScraper 資料庫初始化腳本
-- 請在 Supabase SQL Editor 中執行此腳本
-- =============================================

-- 啟用 UUID 擴充功能
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 自動更新 updated_at 用 trigger 共用
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
  ai_highlights       JSONB         DEFAULT '[]',
  practical_insights  TEXT,
  tags                TEXT[]        DEFAULT '{}',
  relevance_score     SMALLINT      DEFAULT 5,
  published_at        TIMESTAMPTZ,
  processed_at        TIMESTAMPTZ   DEFAULT NOW(),
  created_at          TIMESTAMPTZ   DEFAULT NOW(),
  is_published        BOOLEAN       DEFAULT TRUE
);

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS original_title TEXT,
  ADD COLUMN IF NOT EXISTS translated_title TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS source_name TEXT,
  ADD COLUMN IF NOT EXISTS authors TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS original_abstract TEXT,
  ADD COLUMN IF NOT EXISTS one_sentence_summary TEXT,
  ADD COLUMN IF NOT EXISTS key_findings JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS ai_highlights JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS practical_insights TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS relevance_score SMALLINT DEFAULT 5,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT TRUE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'articles_slug_key'
  ) THEN
    ALTER TABLE articles ADD CONSTRAINT articles_slug_key UNIQUE (slug);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'articles_source_url_key'
  ) THEN
    ALTER TABLE articles ADD CONSTRAINT articles_source_url_key UNIQUE (source_url);
  END IF;
END $$;

-- 效能索引
CREATE INDEX IF NOT EXISTS idx_articles_slug         ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_tags         ON articles USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_articles_is_published ON articles(is_published);
CREATE INDEX IF NOT EXISTS idx_articles_relevance    ON articles(relevance_score DESC);

-- 多來源新聞統整報告表
CREATE TABLE IF NOT EXISTS discovery_reports (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug             TEXT UNIQUE NOT NULL,
  topic            TEXT NOT NULL,
  query            TEXT NOT NULL,
  title            TEXT NOT NULL,
  summary          TEXT,
  markdown_content TEXT NOT NULL,
  source_references JSONB        DEFAULT '[]',
  tags             TEXT[]        DEFAULT '{}',
  source_count     SMALLINT      DEFAULT 0,
  coverage_date    DATE NOT NULL,
  model_name       TEXT,
  created_at       TIMESTAMPTZ   DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   DEFAULT NOW(),
  is_published     BOOLEAN       DEFAULT TRUE,
  UNIQUE(topic, coverage_date)
);

ALTER TABLE discovery_reports
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS topic TEXT,
  ADD COLUMN IF NOT EXISTS query TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS markdown_content TEXT,
  ADD COLUMN IF NOT EXISTS source_references JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source_count SMALLINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coverage_date DATE,
  ADD COLUMN IF NOT EXISTS model_name TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT TRUE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'discovery_reports'
      AND column_name = 'references'
  ) THEN
    EXECUTE 'ALTER TABLE discovery_reports RENAME COLUMN "references" TO source_references';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'discovery_reports_slug_key'
  ) THEN
    ALTER TABLE discovery_reports ADD CONSTRAINT discovery_reports_slug_key UNIQUE (slug);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'discovery_reports_topic_coverage_date_key'
  ) THEN
    ALTER TABLE discovery_reports
      ADD CONSTRAINT discovery_reports_topic_coverage_date_key UNIQUE (topic, coverage_date);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_discovery_reports_slug          ON discovery_reports(slug);
CREATE INDEX IF NOT EXISTS idx_discovery_reports_coverage_date ON discovery_reports(coverage_date DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_reports_tags          ON discovery_reports USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_discovery_reports_is_published  ON discovery_reports(is_published);

-- 電子報訂閱者表
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  is_active     BOOLEAN DEFAULT TRUE
);

ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'newsletter_subscribers_email_key'
  ) THEN
    ALTER TABLE newsletter_subscribers ADD CONSTRAINT newsletter_subscribers_email_key UNIQUE (email);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email);

DROP TRIGGER IF EXISTS set_discovery_reports_updated_at ON discovery_reports;
CREATE TRIGGER set_discovery_reports_updated_at
BEFORE UPDATE ON discovery_reports
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- =============================================
-- Row Level Security (RLS) 設定
-- =============================================

-- articles 表：允許公開讀取已發布文章
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read published articles" ON articles;
DROP POLICY IF EXISTS "Service role full access on articles" ON articles;

CREATE POLICY "Public read published articles"
  ON articles FOR SELECT
  USING (is_published = TRUE);

-- 僅允許 service role 寫入
CREATE POLICY "Service role full access on articles"
  ON articles FOR ALL
  USING (auth.role() = 'service_role');

-- discovery_reports 表：允許公開讀取已發布統整報告
ALTER TABLE discovery_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read published discovery reports" ON discovery_reports;
DROP POLICY IF EXISTS "Service role full access on discovery reports" ON discovery_reports;

CREATE POLICY "Public read published discovery reports"
  ON discovery_reports FOR SELECT
  USING (is_published = TRUE);

CREATE POLICY "Service role full access on discovery reports"
  ON discovery_reports FOR ALL
  USING (auth.role() = 'service_role');

-- newsletter_subscribers 表
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on newsletter" ON newsletter_subscribers;

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
