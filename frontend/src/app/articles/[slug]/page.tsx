import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getArticleBySlug, getAllSlugs } from "@/lib/supabase";
// import AdSense from "@/components/AdSense";
import AIHighlights from "@/components/AIHighlights";
import NewsletterForm from "@/components/NewsletterForm";
import { FiBookmark, FiZap, FiExternalLink } from "react-icons/fi";
import { deriveAIHighlights } from "@/lib/aiHighlights";

// ISR：文章頁面每 24 小時重新驗證
export const revalidate = 86400;

interface Props {
  params: { slug: string };
}

// 在建構時預先生成所有已知文章頁面（SSG）
export async function generateStaticParams() {
  const slugs = await getAllSlugs();
  return slugs.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await getArticleBySlug(params.slug);
  if (!article) return {};

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://eduinsight.tw";

  return {
    title: article.translated_title,
    description: article.one_sentence_summary,
    keywords: article.tags,
    openGraph: {
      title: article.translated_title,
      description: article.one_sentence_summary,
      type: "article",
      publishedTime: article.published_at,
      tags: article.tags,
      url: `${siteUrl}/articles/${article.slug}`,
    },
    alternates: {
      canonical: `/articles/${article.slug}`,
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const article = await getArticleBySlug(params.slug);
  if (!article) notFound();
  const aiHighlights = deriveAIHighlights(article);

  const publishedDate = new Date(article.published_at).toLocaleDateString(
    "zh-TW",
    { year: "numeric", month: "long", day: "numeric" }
  );

  // JSON-LD 結構化資料（提升 Google 搜尋結果富文本片段）
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.translated_title,
    description: article.one_sentence_summary,
    datePublished: article.published_at,
    dateModified: article.processed_at,
    inLanguage: "zh-TW",
    author:
      (article.authors?.length ?? 0) > 0
        ? article.authors.map((name) => ({ "@type": "Person", name }))
        : [{ "@type": "Organization", name: article.source_name }],
    publisher: {
      "@type": "Organization",
      name: "EduInsight",
    },
    isBasedOn: {
      "@type": "ScholarlyArticle",
      url: article.source_url,
      name: article.original_title,
    },
    keywords: (article.tags ?? []).join(", "),
  };

  return (
    <>
      {/* JSON-LD 結構化資料 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* 麵包屑 */}
        <nav aria-label="breadcrumb" className="mb-6 text-sm text-slate-500 dark:text-slate-400">
          <Link href="/" className="transition-colors hover:text-blue-600 dark:hover:text-blue-300">
            首頁
          </Link>
          <span className="mx-2 text-gray-300">/</span>
          <span className="text-slate-800 dark:text-slate-200">研究速報</span>
        </nav>

        <article>
          {/* 文章頭部 */}
          <header className="mb-8">
            {/* 標籤 */}
            <div className="flex flex-wrap gap-2 mb-4">
              {(article.tags ?? []).map((tag) => (
                <Link
                  key={tag}
                  href={`/?tag=${encodeURIComponent(tag)}`}
                  className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20"
                >
                  {tag}
                </Link>
              ))}
            </div>

            <h1 className="mb-4 text-3xl font-extrabold leading-tight text-slate-900 dark:text-white sm:text-4xl">
              {article.translated_title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
              {article.source_name && (
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {article.source_name}
                </span>
              )}
              {(article.authors?.length ?? 0) > 0 && (
                <span>{article.authors.slice(0, 3).join("、")}</span>
              )}
              <time dateTime={article.published_at}>{publishedDate}</time>
            </div>
          </header>

          {/* 一句話摘要（亮點區塊） */}
          <div className="mb-8 rounded-r-xl border-l-4 border-blue-500 bg-blue-50 p-5 dark:bg-blue-500/10">
            <p className="text-base font-semibold leading-relaxed text-blue-900 dark:text-blue-100 sm:text-lg">
              {article.one_sentence_summary}
            </p>
          </div>

          <AIHighlights highlights={aiHighlights} />

          {/* 上方廣告 */}
          {/* <AdSense slot="3456789012" /> */}

          {/* 核心研究發現 */}
          {article.key_findings && article.key_findings.length > 0 && (
            <section className="mb-10" aria-labelledby="findings-heading">
              <h2
                id="findings-heading"
                className="mb-5 flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white"
              >
                <FiBookmark className="text-blue-600" aria-hidden="true" /> 核心研究發現
              </h2>
              <ol className="space-y-4">
                {article.key_findings.map((finding, index) => (
                  <li key={index} className="flex gap-4 items-start">
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                      {index + 1}
                    </span>
                    <p className="pt-0.5 leading-relaxed text-slate-700 dark:text-slate-300">
                      {finding}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* 實務啟發 */}
          {article.practical_insights && (
            <section className="mb-10" aria-labelledby="insights-heading">
              <h2
                id="insights-heading"
                className="mb-5 flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white"
              >
                <FiZap className="text-yellow-500" aria-hidden="true" /> 對教育工作者的啟發
              </h2>
              <div className="rounded-xl border border-green-200 bg-green-50 p-6 dark:border-green-500/20 dark:bg-green-500/10">
                <p className="leading-relaxed text-slate-800 dark:text-slate-200">
                  {article.practical_insights}
                </p>
              </div>
            </section>
          )}

          {/* 中間廣告 */}
          {/* <AdSense slot="4567890123" /> */}

          {/* 原始文獻資訊 */}
          <section className="mb-10 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900/70">
            <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">
              原始文獻資訊
            </h2>
            <dl className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
              <div>
                <dt className="font-semibold inline">英文標題：</dt>
                <dd className="inline">{article.original_title}</dd>
              </div>
              {article.authors.length > 0 && (
                <div>
                  <dt className="font-semibold inline">作者：</dt>
                  <dd className="inline">{(article.authors ?? []).join(", ")}</dd>
                </div>
              )}
              <div>
                <dt className="font-semibold inline">來源：</dt>
                <dd className="inline">{article.source_name}</dd>
              </div>
              {article.model_name && (
                <div>
                  <dt className="font-semibold inline">AI 摘要模型：</dt>
                  <dd className="inline rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">{article.model_name}</dd>
                </div>
              )}
            </dl>
            <a
              href={article.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              閱讀原文
              <FiExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          </section>

          {/* 電子報訂閱 */}
          <NewsletterForm />
        </article>
      </div>
    </>
  );
}
