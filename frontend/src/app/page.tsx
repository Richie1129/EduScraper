import type { Metadata } from "next";
import { getArticles, getLatestDiscoveryReports } from "@/lib/supabase";
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
  const tag = searchParams.tag;

  const [discoveryReports, { articles, total }] = await Promise.all([
    getLatestDiscoveryReports(3),
    getArticles(page, PER_PAGE, tag),
  ]);
  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Hero */}
      <section className="text-center mb-12">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-4 leading-tight">
          教育科技研究速報
        </h1>
        <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
          AI 自動彙整全球學術期刊與教育科技媒體，以繁體中文摘要呈現
          <strong className="text-blue-600"> SRL・PBL・EdTech </strong>
          最新研究，讓台灣教師快速掌握前沿知識。
        </p>
      </section>

      {discoveryReports.length > 0 && (
        <section className="mb-14 overflow-hidden rounded-[32px] border border-amber-200 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_34%),linear-gradient(135deg,_#fffdf7,_#ffffff)] p-6 sm:p-8">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
                <FiCompass className="h-3.5 w-3.5" aria-hidden="true" /> Discovery Engine
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">
                每日新聞統整發現
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-stone-600 sm:text-base">
                以多來源搜尋與引用式摘要，將分散新聞壓縮成可回溯的每日統整報導。
              </p>
            </div>
            <a
              href="/discoveries"
              className="inline-flex items-center gap-2 text-sm font-semibold text-amber-800 hover:text-amber-900"
            >
              查看全部統整
              <FiArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
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
        {[
          { value: "srl", label: "SRL" },
          { value: "pbl", label: "PBL" },
          { value: "ai", label: "AI" },
          { value: "edtech", label: "edtech" },
          { value: "higher education", label: "higher education" },
          { value: "assessment", label: "assessment" },
          { value: "k-12", label: "K-12" },
        ].map(({ value, label }) => (
            <a
              key={value}
              href={tag === value ? "/" : `/?tag=${encodeURIComponent(value)}`}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                tag === value
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-gray-300 text-gray-700 hover:border-blue-400 hover:text-blue-600"
              }`}
            >
              {label}
            </a>
          ))}
        {tag && (
          <a
            href="/"
            className="px-4 py-1.5 rounded-full text-sm font-medium bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 flex items-center gap-1"
          >
            <FiX className="w-3.5 h-3.5" aria-hidden="true" /> 清除篩選
          </a>
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
                <a
                  href={`?page=${page - 1}${tag ? `&tag=${tag}` : ""}`}
                  className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-blue-50 font-medium text-sm"
                >
                  ← 上一頁
                </a>
              )}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <a
                  key={p}
                  href={`?page=${p}${tag ? `&tag=${tag}` : ""}`}
                  aria-current={p === page ? "page" : undefined}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    p === page
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-gray-300 text-gray-700 hover:bg-blue-50"
                  }`}
                >
                  {p}
                </a>
              ))}
              {page < totalPages && (
                <a
                  href={`?page=${page + 1}${tag ? `&tag=${tag}` : ""}`}
                  className="px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-blue-50 font-medium text-sm"
                >
                  下一頁 →
                </a>
              )}
            </nav>
          )}
        </>
      ) : (
        <div className="text-center py-24">
          <FiInbox className="w-16 h-16 mx-auto mb-4 text-gray-300" aria-hidden="true" />
          <p className="text-gray-600 text-lg">
            {tag ? `目前沒有標籤「${tag}」的文章。` : "暫無文章，請稍後再回來。"}
          </p>
          {tag && (
            <a
              href="/"
              className="mt-4 inline-block text-blue-600 hover:underline text-sm"
            >
              查看所有文章 →
            </a>
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
