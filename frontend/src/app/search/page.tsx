import type { Metadata } from "next";
import Link from "next/link";
import { searchArticles } from "@/lib/supabase";
import { FiSearch, FiInbox } from "react-icons/fi";

export const metadata: Metadata = {
  title: "搜尋文章",
  description: "搜尋 EduInsight 收錄的教育科技研究文章",
};

// 搜尋頁不快取，每次請求都重新查詢
export const dynamic = "force-dynamic";

const PER_PAGE = 12;

interface SearchPageProps {
  searchParams: { q?: string; page?: string };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = searchParams.q?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.page ?? "1"));

  const { results, total } = query
    ? await searchArticles(query, page, PER_PAGE)
    : { results: [], total: 0 };

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-8">
        搜尋文章
      </h1>

      {/* 搜尋表單 */}
      <form action="/search" method="GET" className="mb-10">
        <div className="relative">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="輸入關鍵字搜尋，例如：SRL、AI tutoring、知識翻新..."
            className="w-full rounded-xl border border-slate-300 bg-white py-3.5 pl-12 pr-4 text-base text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400"
            autoFocus
          />
        </div>
      </form>

      {/* 搜尋結果 */}
      {query && (
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
          找到 <span className="font-semibold text-slate-700 dark:text-slate-200">{total}</span> 筆關於「<span className="font-semibold text-slate-700 dark:text-slate-200">{query}</span>」的結果
        </p>
      )}

      {results.length > 0 ? (
        <>
          <div className="space-y-4">
            {results.map((item) => {
              const createdDate = new Date(item.created_at).toLocaleDateString(
                "zh-TW",
                { year: "numeric", month: "long", day: "numeric" }
              );
              return (
                <article
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                >
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {item.tags.slice(0, 4).map((tag) => (
                      <Link
                        key={tag}
                        href={`/?tag=${encodeURIComponent(tag)}`}
                        className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20"
                      >
                        {tag}
                      </Link>
                    ))}
                  </div>
                  <Link href={`/articles/${item.slug}`}>
                    <h2 className="text-lg font-bold text-slate-900 transition-colors hover:text-blue-600 dark:text-white dark:hover:text-blue-300">
                      {item.translated_title}
                    </h2>
                  </Link>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    {item.one_sentence_summary}
                  </p>
                  <div className="mt-3 flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      {item.source_name}
                    </span>
                    <time dateTime={item.created_at}>{createdDate}</time>
                  </div>
                </article>
              );
            })}
          </div>

          {/* 分頁 */}
          {totalPages > 1 && (
            <nav
              aria-label="搜尋結果分頁"
              className="mt-10 flex justify-center gap-2 flex-wrap"
            >
              {page > 1 && (
                <Link
                  href={`/search?q=${encodeURIComponent(query)}&page=${page - 1}`}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  ← 上一頁
                </Link>
              )}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/search?q=${encodeURIComponent(query)}&page=${p}`}
                  aria-current={p === page ? "page" : undefined}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    p === page
                      ? "bg-blue-600 text-white"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                >
                  {p}
                </Link>
              ))}
              {page < totalPages && (
                <Link
                  href={`/search?q=${encodeURIComponent(query)}&page=${page + 1}`}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  下一頁 →
                </Link>
              )}
            </nav>
          )}
        </>
      ) : query ? (
        <div className="text-center py-20">
          <FiInbox className="mx-auto mb-4 h-16 w-16 text-slate-300 dark:text-slate-700" aria-hidden="true" />
          <p className="text-lg text-slate-600 dark:text-slate-300">
            找不到與「{query}」相關的文章
          </p>
          <p className="mt-2 text-sm text-slate-400 dark:text-slate-500">
            試試其他關鍵字，或瀏覽全部主題
          </p>
        </div>
      ) : null}
    </div>
  );
}
