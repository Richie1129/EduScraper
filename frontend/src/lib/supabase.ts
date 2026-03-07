import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Article, ArticleListResult } from "@/types/article";

// 懶惰初始化：建構期間若沒有設定環境變數，函式會直接回傳空結果
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key, {
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: "no-store" }),
    },
  });
  return _client;
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
  const supabase = getClient();
  if (!supabase) return { articles: [], total: 0 };

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from("articles")
    .select("*", { count: "exact" })
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .range(from, to);

  if (tag) {
    query = query.contains("tags", [tag]);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("[Supabase] getArticles error:", error.message);
    return { articles: [], total: 0 };
  }

  return {
    articles: (data as Article[]) ?? [],
    total: count ?? 0,
  };
}

/**
 * 根據 slug 取得單篇文章。
 * 找不到或發生錯誤時回傳 null。
 */
export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const supabase = getClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (error || !data) return null;
  return data as Article;
}

/**
 * 取得所有 slug（供 generateStaticParams 使用）。
 */
export async function getAllSlugs(): Promise<
  Array<{ slug: string; published_at: string }>
> {
  const supabase = getClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("articles")
    .select("slug, published_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  if (error || !data) return [];
  return data;
}
