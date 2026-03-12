BEGIN;

ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS ai_highlights JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'articles_ai_highlights_is_array'
  ) THEN
    ALTER TABLE public.articles
    ADD CONSTRAINT articles_ai_highlights_is_array
    CHECK (jsonb_typeof(ai_highlights) = 'array');
  END IF;
END $$;

COMMENT ON COLUMN public.articles.ai_highlights IS
'AI 產生的重點摘要陣列，每個元素包含 point 與 reason。';

UPDATE public.articles
SET ai_highlights = '[]'::jsonb
WHERE ai_highlights IS NULL;

COMMIT;