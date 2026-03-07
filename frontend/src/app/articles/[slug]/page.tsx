import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getArticleBySlug, getAllSlugs } from "@/lib/supabase";
// import AdSense from "@/components/AdSense";
import NewsletterForm from "@/components/NewsletterForm";
import { FiBookmark, FiZap, FiExternalLink } from "react-icons/fi";

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
        <nav aria-label="breadcrumb" className="text-sm text-gray-500 mb-6">
          <Link href="/" className="hover:text-blue-600 transition-colors">
            首頁
          </Link>
          <span className="mx-2 text-gray-300">/</span>
          <span className="text-gray-800">研究速報</span>
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
                  className="text-xs font-semibold px-3 py-1 bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors"
                >
                  {tag}
                </Link>
              ))}
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight mb-4">
              {article.translated_title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
              {article.source_name && (
                <span className="font-semibold text-gray-700">
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
          <div className="bg-blue-50 border-l-4 border-blue-500 p-5 rounded-r-xl mb-8">
            <p className="text-blue-900 font-semibold leading-relaxed text-base sm:text-lg">
              {article.one_sentence_summary}
            </p>
          </div>

          {/* 上方廣告 */}
          {/* <AdSense slot="3456789012" /> */}

          {/* 核心研究發現 */}
          {article.key_findings && article.key_findings.length > 0 && (
            <section className="mb-10" aria-labelledby="findings-heading">
              <h2
                id="findings-heading"
                className="text-xl font-bold text-gray-900 mb-5 flex items-center gap-2"
              >
                <FiBookmark className="text-blue-600" aria-hidden="true" /> 核心研究發現
              </h2>
              <ol className="space-y-4">
                {article.key_findings.map((finding, index) => (
                  <li key={index} className="flex gap-4 items-start">
                    <span className="flex-shrink-0 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </span>
                    <p className="text-gray-700 leading-relaxed pt-0.5">
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
                className="text-xl font-bold text-gray-900 mb-5 flex items-center gap-2"
              >
                <FiZap className="text-yellow-500" aria-hidden="true" /> 對教育工作者的啟發
              </h2>
              <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                <p className="text-gray-800 leading-relaxed">
                  {article.practical_insights}
                </p>
              </div>
            </section>
          )}

          {/* 中間廣告 */}
          {/* <AdSense slot="4567890123" /> */}

          {/* 原始文獻資訊 */}
          <section className="mb-10 p-6 bg-gray-50 border border-gray-200 rounded-xl">
            <h2 className="text-base font-bold text-gray-900 mb-4">
              原始文獻資訊
            </h2>
            <dl className="space-y-2 text-sm text-gray-700">
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
                  <dd className="inline font-mono text-xs bg-gray-200 px-1.5 py-0.5 rounded">{article.model_name}</dd>
                </div>
              )}
            </dl>
            <a
              href={article.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors"
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
