import type { Metadata } from "next";
import { FiHash } from "react-icons/fi";
import TopicDirectory from "@/components/TopicDirectory";
import { getPopularTags } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "全部主題",
  description: "依文章數量瀏覽 EduInsight 所有熱門主題與研究分類。",
};

export const revalidate = 3600;

export default async function TopicsPage() {
  const topics = await getPopularTags();

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <section className="mb-10 rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.14),_transparent_28%),linear-gradient(135deg,_#ffffff,_#f8fafc)] p-8 shadow-sm dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_24%),linear-gradient(135deg,_rgba(15,23,42,0.96),_rgba(2,6,23,0.98))]">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700 dark:bg-blue-500/10 dark:text-blue-200">
          <FiHash className="h-3.5 w-3.5" aria-hidden="true" /> Topic Directory
        </div>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          全部主題
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-base">
          依資料庫中的文章數量排序，快速掌握目前站上最常出現的研究主題與教育科技議題。
        </p>
      </section>

      <TopicDirectory topics={topics} />
    </div>
  );
}