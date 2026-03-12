import type { Metadata } from "next";
import Link from "next/link";
import { getArticles, getLatestDiscoveryReports, getPopularTags } from "@/lib/supabase";
import ArticleCard from "@/components/ArticleCard";
import DiscoveryCard from "@/components/DiscoveryCard";
import NewsletterForm from "@/components/NewsletterForm";
import { FiArrowRight, FiCompass, FiInbox, FiX } from "react-icons/fi";

// ISR：每小時重新驗證一次，確保新文章即時呈現
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "EduInsight｜教育科技研究速報",
  description:
    "每日自動彙整全球最新教育科技、自主學習（SRL）、專題式學習（PBL）研究，以繁體中文 AI 摘要快速呈現核心發現。",
};

const PER_PAGE = 12;

interface HomePageProps {
  searchParams: { page?: string; tag?: string };
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const page = Math.max(1, parseInt(searchParams.page ?? "1"));
  const tag = searchParams.tag?.trim().toLowerCase();

  const [discoveryReports, popularTags, { articles, total }] = await Promise.all([
    getLatestDiscoveryReports(3),
    getPopularTags(8),
    getArticles(page, PER_PAGE, tag),
  ]);
  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Hero */}
      <section className="text-center mb-12">
        <h1 className="mb-4 text-4xl font-extrabold leading-tight text-slate-900 dark:text-white sm:text-5xl">
          教育科技研究速報
        </h1>
        <p className="mx-auto max-w-3xl text-lg leading-relaxed text-slate-600 dark:text-slate-300 sm:text-xl">
          AI 自動彙整全球學術期刊與教育科技媒體，以繁體中文摘要呈現
          <strong className="text-blue-600 dark:text-blue-300"> SRL・PBL・EdTech </strong>
          最新研究，讓台灣教師快速掌握前沿知識。
        </p>
      </section>

      {discoveryReports.length > 0 && (
        <section className="mb-14 overflow-hidden rounded-[32px] border border-amber-200 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_34%),linear-gradient(135deg,_#fffdf7,_#ffffff)] p-6 dark:border-amber-500/20 dark:bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.14),_transparent_30%),linear-gradient(135deg,_rgba(30,41,59,0.94),_rgba(15,23,42,0.98))] sm:p-8">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                <FiCompass className="h-3.5 w-3.5" aria-hidden="true" /> Discovery Engine
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-stone-900 dark:text-white sm:text-3xl">
                每日新聞統整發現
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-stone-600 dark:text-slate-300 sm:text-base">
                以多來源搜尋與引用式摘要，將分散新聞壓縮成可回溯的每日統整報導。
              </p>
            </div>
            <Link
              href="/discoveries"
              className="inline-flex items-center gap-2 text-sm font-semibold text-amber-800 hover:text-amber-900 dark:text-amber-200 dark:hover:text-amber-100"
            >
              查看全部統整
              <FiArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {discoveryReports.map((report) => (
              <DiscoveryCard key={report.id} report={report} />
            ))}
          </div>
        </section>
      )}

      {/* 標籤篩選列 */}
      <div className="flex flex-wrap gap-2 mb-8 justify-center">
        {popularTags.map(({ value, label }) => (
            <Link
              key={value}
              href={tag === value ? "/" : `/?tag=${encodeURIComponent(value)}`}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                tag === value
                  ? "bg-blue-600 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
              }`}
            >
              {label}
            </Link>
          ))}
        <Link
          href="/topics"
          className="px-4 py-1.5 rounded-full text-sm font-medium border border-slate-300 bg-white text-slate-700 transition-colors hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:text-blue-300"
        >
          查看全部主題
        </Link>
        {tag && (
          <Link
            href="/"
            className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
          >
            <FiX className="w-3.5 h-3.5" aria-hidden="true" /> 清除篩選
          </Link>
        )}
      </div>

      {/* 文章列表 */}
      {articles.length > 0 ? (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>

          {/* 分頁 */}
          {totalPages > 1 && (
            <nav
              aria-label="分頁導覽"
              className="mt-12 flex justify-center gap-2 flex-wrap"
            >
              {page > 1 && (
                <Link
                  href={`?page=${page - 1}${tag ? `&tag=${tag}` : ""}`}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  ← 上一頁
                </Link>
              )}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`?page=${p}${tag ? `&tag=${tag}` : ""}`}
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
                  href={`?page=${page + 1}${tag ? `&tag=${tag}` : ""}`}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  下一頁 →
                </Link>
              )}
            </nav>
          )}
        </>
      ) : (
        <div className="text-center py-24">
          <FiInbox className="mx-auto mb-4 h-16 w-16 text-slate-300 dark:text-slate-700" aria-hidden="true" />
          <p className="text-lg text-slate-600 dark:text-slate-300">
            {tag ? `目前沒有標籤「${tag}」的文章。` : "暫無文章，請稍後再回來。"}
          </p>
          {tag && (
            <Link
              href="/"
              className="mt-4 inline-block text-sm text-blue-600 hover:underline dark:text-blue-300"
            >
              查看所有文章 →
            </Link>
          )}
        </div>
      )}

      {/* 電子報 */}
      <div className="mt-16">
        <NewsletterForm />
      </div>
    </div>
  );
}
