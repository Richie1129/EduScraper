import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { FiArrowLeft, FiCompass, FiExternalLink, FiLayers } from "react-icons/fi";
import MarkdownWithCitations from "@/components/MarkdownWithCitations";
import {
  getAllDiscoverySlugs,
  getDiscoveryReportBySlug,
} from "@/lib/supabase";

export const revalidate = 3600;

interface Props {
  params: { slug: string };
}

export async function generateStaticParams() {
  const slugs = await getAllDiscoverySlugs();
  return slugs.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const report = await getDiscoveryReportBySlug(params.slug);
  if (!report) return {};

  return {
    title: report.title,
    description: report.summary,
    keywords: report.tags,
    alternates: {
      canonical: `/discoveries/${report.slug}`,
    },
    openGraph: {
      title: report.title,
      description: report.summary,
      type: "article",
      url: `/discoveries/${report.slug}`,
    },
  };
}

export default async function DiscoveryDetailPage({ params }: Props) {
  const report = await getDiscoveryReportBySlug(params.slug);
  if (!report) notFound();

  const coverageDate = new Date(report.coverage_date).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: report.title,
    description: report.summary,
    datePublished: report.created_at,
    dateModified: report.updated_at,
    inLanguage: "zh-TW",
    keywords: report.tags.join(", "),
    publisher: {
      "@type": "Organization",
      name: "EduInsight",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <nav className="mb-6 text-sm text-stone-500" aria-label="breadcrumb">
          <Link href="/" className="hover:text-amber-700">
            首頁
          </Link>
          <span className="mx-2 text-stone-300">/</span>
          <Link href="/discoveries" className="hover:text-amber-700">
            新聞統整
          </Link>
          <span className="mx-2 text-stone-300">/</span>
          <span className="text-stone-800">{report.topic}</span>
        </nav>

        <article className="overflow-hidden rounded-[36px] border border-stone-200 bg-white shadow-[0_20px_80px_-40px_rgba(28,25,23,0.4)]">
          <header className="border-b border-stone-200 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.2),_transparent_34%),linear-gradient(180deg,_#fffdf8,_#ffffff)] px-6 py-8 sm:px-10 sm:py-10">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-amber-800 shadow-sm">
                <FiCompass className="h-3.5 w-3.5" aria-hidden="true" /> Discovery
              </span>
              <span>{coverageDate}</span>
            </div>

            <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight text-stone-900 sm:text-5xl">
              {report.title}
            </h1>

            <p className="mt-4 max-w-3xl text-base leading-8 text-stone-600 sm:text-lg">
              {report.summary}
            </p>

            <div className="mt-6 flex flex-wrap gap-3 text-sm text-stone-600">
              <span className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1.5">
                <FiLayers className="h-4 w-4" aria-hidden="true" /> {report.source_count} 個來源
              </span>
              <span className="rounded-full bg-stone-100 px-3 py-1.5">主題：{report.topic}</span>
              {report.model_name && (
                <span className="rounded-full bg-stone-100 px-3 py-1.5">模型：{report.model_name}</span>
              )}
            </div>
          </header>

          <div className="grid gap-10 px-6 py-8 sm:px-10 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div>
              <MarkdownWithCitations
                content={report.markdown_content}
                references={report.source_references ?? []}
              />
            </div>

            <aside className="space-y-4">
              <div className="rounded-[28px] border border-stone-200 bg-stone-50 p-5">
                <h2 className="text-base font-bold text-stone-900">閱讀方式</h2>
                <p className="mt-3 text-sm leading-7 text-stone-600">
                  文內引用如 [1] 可直接開啟原始來源；滑鼠懸停時會顯示來源標題與摘錄，方便快速核對。
                </p>
              </div>

              <div className="rounded-[28px] border border-stone-200 bg-white p-5">
                <h2 className="text-base font-bold text-stone-900">關鍵標籤</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {report.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </aside>
          </div>

          <section className="border-t border-stone-200 bg-stone-50 px-6 py-8 sm:px-10">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-stone-900">參考來源</h2>
              <Link
                href="/discoveries"
                className="inline-flex items-center gap-2 text-sm font-semibold text-amber-800 hover:text-amber-900"
              >
                <FiArrowLeft className="h-4 w-4" aria-hidden="true" /> 返回列表
              </Link>
            </div>

            <ol className="space-y-4">
              {(report.source_references ?? []).map((reference) => (
                <li
                  key={reference.id}
                  id={`source-${reference.id}`}
                  className="rounded-[24px] border border-stone-200 bg-white p-5"
                >
                  <div className="flex items-start gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-800">
                      {reference.id}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                        <span>{reference.source_name || reference.domain}</span>
                        {reference.published_at && <span>{reference.published_at}</span>}
                      </div>
                      <h3 className="mt-2 text-lg font-bold text-stone-900">
                        {reference.title}
                      </h3>
                      {reference.excerpt && (
                        <p className="mt-2 text-sm leading-7 text-stone-600">
                          {reference.excerpt}
                        </p>
                      )}
                      <a
                        href={reference.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-amber-800 hover:text-amber-900"
                      >
                        開啟原文 <FiExternalLink className="h-4 w-4" aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </article>
      </div>
    </>
  );
}