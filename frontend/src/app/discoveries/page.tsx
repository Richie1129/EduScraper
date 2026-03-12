import type { Metadata } from "next";
import Link from "next/link";
import { FiArrowLeft, FiCompass } from "react-icons/fi";
import DiscoveryCard from "@/components/DiscoveryCard";
import { getLatestDiscoveryReports } from "@/lib/supabase";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "新聞統整發現",
  description:
    "每日將多篇教育科技新聞壓縮成可追溯來源的綜合報導，快速掌握 AI 教育、評量與學習分析趨勢。",
  alternates: {
    canonical: "/discoveries",
  },
};

export default async function DiscoveriesPage() {
  const reports = await getLatestDiscoveryReports(24);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="rounded-[36px] border border-stone-200 bg-[linear-gradient(145deg,_#fffef9,_#fff)] p-8 shadow-[0_24px_80px_-36px_rgba(28,25,23,0.35)] sm:p-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
              <FiCompass className="h-3.5 w-3.5" aria-hidden="true" /> Discovery Reports
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-stone-900">
              新聞統整發現引擎
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-8 text-stone-600">
              每篇報導都由搜尋 API 擷取來源、再交由 LLM 產生句句附註的 Markdown 綜合報導。你可以直接點擊文內 [1] 引用，回到原始來源驗證敘述。
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-stone-700 hover:text-stone-900"
          >
            <FiArrowLeft className="h-4 w-4" aria-hidden="true" /> 返回首頁
          </Link>
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => (
          <DiscoveryCard key={report.id} report={report} />
        ))}
      </section>
    </div>
  );
}