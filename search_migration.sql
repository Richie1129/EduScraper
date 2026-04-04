-- =============================================
-- 全文搜尋功能 Migration
-- 請在 Supabase SQL Editor 中執行此腳本
-- =============================================

-- 1. 新增 tsvector 欄位，支援中英文搜尋
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(original_title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(translated_title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(one_sentence_summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(practical_insights, '')), 'C')
  ) STORED;

-- 2. 建立 GIN 索引加速搜尋
CREATE INDEX IF NOT EXISTS idx_articles_fts ON articles USING GIN(fts);

-- 3. 建立 RPC 函式供前端呼叫
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

-- 4. 計算搜尋結果總數的函式
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
