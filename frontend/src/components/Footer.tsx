import Link from "next/link";
import { FiAlertTriangle, FiBook, FiRss } from "react-icons/fi";
import { getPopularTags } from "@/lib/supabase";

export default async function Footer() {
  const topicLinks = await getPopularTags(6);

  return (
    <footer className="mt-20 border-t border-slate-200 bg-slate-900 text-slate-400 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-10 mb-10">
          {/* 品牌介紹 */}
          <div>
            <Link href="/" className="flex items-center gap-2 mb-4">
              <FiBook className="w-6 h-6 text-blue-400" aria-hidden="true" />
              <span className="text-xl font-extrabold text-white">
                EduInsight
              </span>
            </Link>
            <p className="text-sm leading-relaxed">
              每日自動彙整全球教育科技與學習科學研究，以繁體中文 AI
              摘要助力台灣教師掌握前沿知識。
            </p>
          </div>

          {/* 主題分類 */}
          <div>
            <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">
              主題分類
            </h3>
            <ul className="space-y-2">
              {topicLinks.map(({ href, label, count }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="flex items-center justify-between gap-3 text-sm hover:text-white transition-colors"
                  >
                    <span>{label}</span>
                    <span className="text-xs text-slate-500">{count}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/topics"
              className="mt-4 inline-flex text-sm font-semibold text-blue-300 transition-colors hover:text-white"
            >
              查看全部主題
            </Link>
          </div>

          {/* 關於本站 */}
          <div>
            <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">
              關於本站
            </h3>
            <ul className="space-y-2 text-sm">
              <li>內容來源：國際學術期刊、arXiv、EdTech 媒體</li>
              <li>更新頻率：每日自動更新</li>
              <li>語言：繁體中文 AI 摘要</li>
              <li className="flex items-center gap-1.5">
                <FiAlertTriangle className="text-yellow-400 shrink-0" aria-hidden="true" />
                AI 摘要僅供參考，完整資訊請閱讀原文
              </li>
              <li className="mt-3">
                <Link
                  href="/api/rss"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-400 transition-colors hover:text-orange-300"
                >
                  <FiRss className="h-4 w-4" aria-hidden="true" />
                  RSS 訂閱
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-700 pt-8 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} EduInsight. AI 摘要由大型語言模型生成，內容僅供參考。
        </div>
      </div>
    </footer>
  );
}
