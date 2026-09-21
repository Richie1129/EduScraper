-- =============================================
-- EduScraper 資料庫 schema（標準 PostgreSQL，可重複執行）
--
-- 整合自舊的 setup_db.sql / search_migration.sql / ai_highlights_migration.sql，
-- 並補上管線實際寫入、但舊腳本未定義的欄位（research_method、target_audience、model_name）。
-- 不再使用 Supabase 專屬的 RLS 與 auth.role()：資料庫只給應用程式帳號連線，
-- 對外不開放，存取控制由應用程式本身負責。
--
-- 執行方式：
--   docker compose exec -T db psql -U eduscraper -d eduscraper -v ON_ERROR_STOP=1 < db/schema.sql
-- =============================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 自動更新 updated_at 用 trigger 共用
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 文章主表 ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS articles (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug                 TEXT UNIQUE NOT NULL,
  original_title       TEXT NOT NULL,
  translated_title     TEXT,
  source_url           TEXT UNIQUE NOT NULL,
  source_name          TEXT,
  authors              TEXT[]       DEFAULT '{}',
  original_abstract    TEXT,
  one_sentence_summary TEXT,
  key_findings         JSONB        DEFAULT '[]',
  ai_highlights        JSONB        NOT NULL DEFAULT '[]'::jsonb
                       CONSTRAINT articles_ai_highlights_is_array
                       CHECK (jsonb_typeof(ai_highlights) = 'array'),
  research_method      TEXT,
  target_audience      TEXT,
  practical_insights   TEXT,
  tags                 TEXT[]       DEFAULT '{}',
  relevance_score      SMALLINT     DEFAULT 5,
  model_name           TEXT,
  published_at         TIMESTAMPTZ,
  processed_at         TIMESTAMPTZ  DEFAULT NOW(),
  created_at           TIMESTAMPTZ  DEFAULT NOW(),
  is_published         BOOLEAN      DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_created_at   ON articles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_tags         ON articles USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_articles_is_published ON articles(is_published);
CREATE INDEX IF NOT EXISTS idx_articles_relevance    ON articles(relevance_score DESC);

-- ── 全文搜尋 ──────────────────────────────────────────────────
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(original_title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(translated_title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(one_sentence_summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(practical_insights, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_articles_fts ON articles USING GIN(fts);

CREATE OR REPLACE FUNCTION search_articles(
  search_query text,
  result_limit int DEFAULT 20,
  result_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  slug text,
  original_title text,
  translated_title text,
  source_url text,
  source_name text,
  one_sentence_summary text,
  tags text[],
  relevance_score smallint,
  created_at timestamptz,
  search_rank real
)
LANGUAGE sql STABLE
AS $$
  SELECT
    a.id,
    a.slug,
    a.original_title,
    a.translated_title,
    a.source_url,
    a.source_name,
    a.one_sentence_summary,
    a.tags,
    a.relevance_score,
    a.created_at,
    ts_rank(a.fts, websearch_to_tsquery('english', search_query)) AS search_rank
  FROM articles a
  WHERE a.is_published = true
    AND (
      a.fts @@ websearch_to_tsquery('english', search_query)
      OR a.translated_title ILIKE '%' || search_query || '%'
      OR a.original_title ILIKE '%' || search_query || '%'
      OR search_query ILIKE ANY (
        SELECT '%' || unnest(a.tags) || '%'
      )
    )
  ORDER BY search_rank DESC, a.created_at DESC
  LIMIT result_limit
  OFFSET result_offset;
$$;

CREATE OR REPLACE FUNCTION search_articles_count(search_query text)
RETURNS bigint
LANGUAGE sql STABLE
AS $$
  SELECT count(*)
  FROM articles a
  WHERE a.is_published = true
    AND (
      a.fts @@ websearch_to_tsquery('english', search_query)
      OR a.translated_title ILIKE '%' || search_query || '%'
      OR a.original_title ILIKE '%' || search_query || '%'
      OR search_query ILIKE ANY (
        SELECT '%' || unnest(a.tags) || '%'
      )
    );
$$;

-- ── 多來源新聞統整報告表 ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS discovery_reports (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug              TEXT UNIQUE NOT NULL,
  topic             TEXT NOT NULL,
  query             TEXT NOT NULL,
  title             TEXT NOT NULL,
  summary           TEXT,
  markdown_content  TEXT NOT NULL,
  source_references JSONB       DEFAULT '[]',
  tags              TEXT[]      DEFAULT '{}',
  source_count      SMALLINT    DEFAULT 0,
  coverage_date     DATE NOT NULL,
  model_name        TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  is_published      BOOLEAN     DEFAULT TRUE,
  UNIQUE (topic, coverage_date)
);

CREATE INDEX IF NOT EXISTS idx_discovery_reports_coverage_date ON discovery_reports(coverage_date DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_reports_tags          ON discovery_reports USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_discovery_reports_is_published  ON discovery_reports(is_published);

DROP TRIGGER IF EXISTS set_discovery_reports_updated_at ON discovery_reports;
CREATE TRIGGER set_discovery_reports_updated_at
BEFORE UPDATE ON discovery_reports
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ── 電子報訂閱者表 ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  is_active     BOOLEAN DEFAULT TRUE
);
