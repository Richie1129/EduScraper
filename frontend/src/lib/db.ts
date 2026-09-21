import { Pool, types } from "pg";
import type { Article, ArticleListResult, SearchResult } from "@/types/article";
import type { DiscoveryReport } from "@/types/discovery";
import {
  buildPopularTopicTag,
  PRIMARY_TOPIC_TAGS,
  type PopularTopicTag,
} from "@/lib/topicTags";

// pg 預設把 timestamptz / date 轉成 Date、bigint 轉成字串；
// Server Component 傳給 Client Component 需要可序列化的值，且型別定義是字串 / number。
// pg 的型別解析器是全域共用狀態，而此模組可能被不同 bundle 重複載入；
// 原始解析器只記錄一次，避免第二次載入時包到已被覆寫的解析器。
const globalForParser = globalThis as unknown as {
  __eduscraperParseTimestamptz?: (value: string) => unknown;
};
const parseTimestamptz = (globalForParser.__eduscraperParseTimestamptz ??=
  types.getTypeParser(1184, "text"));
types.setTypeParser(1184, (value: string) =>
  (parseTimestamptz(value) as Date).toISOString()
);
types.setTypeParser(1082, (value: string) => value); // date → "YYYY-MM-DD"
types.setTypeParser(20, (value: string) => Number(value)); // bigint → number

// 排除 fts（tsvector 內部欄位），避免傳給前端
export const ARTICLE_COLUMNS = [
  "id", "slug", "original_title", "translated_title", "source_url",
  "source_name", "authors", "original_abstract", "one_sentence_summary",
  "key_findings", "ai_highlights", "research_method", "target_audience",
  "practical_insights", "tags", "relevance_score", "model_name",
  "published_at", "processed_at", "created_at", "is_published",
].join(", ");

// 開發模式熱重載時重用同一個連線池，避免連線數暴增
const globalForPool = globalThis as unknown as { __eduscraperPool?: Pool };

/**
 * 懶惰初始化連線池：建構期間若沒有設定 DATABASE_URL，函式會直接回傳空結果。
 */
export function getPool(): Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;

  if (!globalForPool.__eduscraperPool) {
    const pool = new Pool({
      connectionString: url,
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      statement_timeout: 15000,
    });
    pool.on("error", (error) => {
      console.error("[DB] idle client error:", error.message);
    });
    globalForPool.__eduscraperPool = pool;
  }
  return globalForPool.__eduscraperPool;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * 取得分頁文章列表，可依 tag 篩選。
 * 在 Next.js 伺服器元件中使用 ISR 重新驗證。
 */
export async function getArticles(
  page = 1,
  perPage = 12,
  tag?: string
): Promise<ArticleListResult> {
  const pool = getPool();
  if (!pool) return { articles: [], total: 0 };

  const where = tag
    ? "is_published = TRUE AND tags @> $1::text[]"
    : "is_published = TRUE";
  const filterParams = tag ? [[tag]] : [];
  const nextParam = filterParams.length + 1;

  try {
    const [list, count] = await Promise.all([
      pool.query<Article>(
        `SELECT ${ARTICLE_COLUMNS} FROM articles WHERE ${where}
         ORDER BY created_at DESC LIMIT $${nextParam} OFFSET $${nextParam + 1}`,
        [...filterParams, perPage, (page - 1) * perPage]
      ),
      pool.query<{ n: number }>(
        `SELECT count(*) AS n FROM articles WHERE ${where}`,
        filterParams
      ),
    ]);

    return { articles: list.rows, total: count.rows[0]?.n ?? 0 };
  } catch (error) {
    console.error("[DB] getArticles error:", errorMessage(error));
    return { articles: [], total: 0 };
  }
}

/**
 * 根據 slug 取得單篇文章。
 * 找不到或發生錯誤時回傳 null。
 */
export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const pool = getPool();
  if (!pool) return null;

  try {
    const { rows } = await pool.query<Article>(
      `SELECT ${ARTICLE_COLUMNS} FROM articles
       WHERE slug = $1 AND is_published = TRUE LIMIT 1`,
      [slug]
    );
    return rows[0] ?? null;
  } catch (error) {
    console.error("[DB] getArticleBySlug error:", errorMessage(error));
    return null;
  }
}

/**
 * 取得所有 slug（供 generateStaticParams 使用）。
 */
export async function getAllSlugs(): Promise<
  Array<{ slug: string; created_at: string }>
> {
  const pool = getPool();
  if (!pool) return [];

  try {
    const { rows } = await pool.query<{ slug: string; created_at: string }>(
      `SELECT slug, created_at FROM articles
       WHERE is_published = TRUE ORDER BY created_at DESC`
    );
    return rows;
  } catch (error) {
    console.error("[DB] getAllSlugs error:", errorMessage(error));
    return [];
  }
}

export async function getLatestDiscoveryReports(
  limit = 3
): Promise<DiscoveryReport[]> {
  const pool = getPool();
  if (!pool) return [];

  try {
    const { rows } = await pool.query<DiscoveryReport>(
      `SELECT * FROM discovery_reports WHERE is_published = TRUE
       ORDER BY coverage_date DESC, created_at DESC LIMIT $1`,
      [limit]
    );
    return rows;
  } catch (error) {
    console.error("[DB] getLatestDiscoveryReports error:", errorMessage(error));
    return [];
  }
}

export async function getDiscoveryReportBySlug(
  slug: string
): Promise<DiscoveryReport | null> {
  const pool = getPool();
  if (!pool) return null;

  try {
    const { rows } = await pool.query<DiscoveryReport>(
      `SELECT * FROM discovery_reports
       WHERE slug = $1 AND is_published = TRUE LIMIT 1`,
      [slug]
    );
    return rows[0] ?? null;
  } catch (error) {
    console.error("[DB] getDiscoveryReportBySlug error:", errorMessage(error));
    return null;
  }
}

export async function getAllDiscoverySlugs(): Promise<
  Array<{ slug: string; updated_at: string }>
> {
  const pool = getPool();
  if (!pool) return [];

  try {
    const { rows } = await pool.query<{ slug: string; updated_at: string }>(
      `SELECT slug, updated_at FROM discovery_reports
       WHERE is_published = TRUE ORDER BY coverage_date DESC`
    );
    return rows;
  } catch (error) {
    console.error("[DB] getAllDiscoverySlugs error:", errorMessage(error));
    return [];
  }
}

/**
 * 全文搜尋文章（呼叫資料庫函式 search_articles，定義於 db/schema.sql）
 */
export async function searchArticles(
  query: string,
  page = 1,
  perPage = 12
): Promise<SearchResult> {
  const pool = getPool();
  const searchQuery = query.trim();
  if (!pool || !searchQuery) return { results: [], total: 0 };

  try {
    const [list, count] = await Promise.all([
      pool.query<SearchResult["results"][number]>(
        "SELECT * FROM search_articles($1, $2, $3)",
        [searchQuery, perPage, (page - 1) * perPage]
      ),
      pool.query<{ n: number }>("SELECT search_articles_count($1) AS n", [
        searchQuery,
      ]),
    ]);

    return { results: list.rows, total: count.rows[0]?.n ?? 0 };
  } catch (error) {
    console.error("[DB] searchArticles error:", errorMessage(error));
    return { results: [], total: 0 };
  }
}

export async function getPopularTags(
  limit?: number
): Promise<PopularTopicTag[]> {
  const fallbackTags = () =>
    PRIMARY_TOPIC_TAGS.slice(0, limit ?? PRIMARY_TOPIC_TAGS.length).map(
      (tag) => ({ ...tag, count: 0 })
    );

  const pool = getPool();
  if (!pool) return fallbackTags();

  let rows: Array<{ tags: string[] | null }>;
  try {
    ({ rows } = await pool.query<{ tags: string[] | null }>(
      "SELECT tags FROM articles WHERE is_published = TRUE"
    ));
  } catch (error) {
    console.error("[DB] getPopularTags error:", errorMessage(error));
    return fallbackTags();
  }

  const tagCounts = new Map<string, number>();
  for (const row of rows) {
    for (const rawTag of row.tags ?? []) {
      const normalizedTag = String(rawTag).trim().toLowerCase();
      if (!normalizedTag) continue;
      tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) ?? 0) + 1);
    }
  }

  const sortedTags = Array.from(tagCounts.entries())
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return left[0].localeCompare(right[0], "en");
    })
    .map(([value, count]) => buildPopularTopicTag(value, count));

  if (sortedTags.length === 0) return fallbackTags();

  return typeof limit === "number" ? sortedTags.slice(0, limit) : sortedTags;
}
