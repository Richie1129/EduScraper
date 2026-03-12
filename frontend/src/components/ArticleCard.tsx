import Link from "next/link";
import type { Article } from "@/types/article";

interface ArticleCardProps {
  article: Article;
}

export default function ArticleCard({ article }: ArticleCardProps) {
  const createdDate = new Date(article.created_at).toLocaleDateString(
    "zh-TW",
    { year: "numeric", month: "long", day: "numeric" }
  );

  return (
    <article className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      <div className="p-6 flex flex-col flex-1">
        {/* 標籤列 */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {article.tags.slice(0, 3).map((tag) => (
            <Link
              key={tag}
              href={`/?tag=${encodeURIComponent(tag)}`}
              className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20"
            >
              {tag}
            </Link>
          ))}
        </div>

        {/* 標題 */}
        <Link href={`/articles/${article.slug}`} className="group mb-2">
          <h2 className="line-clamp-2 text-base font-bold leading-snug text-slate-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-300">
            {article.translated_title}
          </h2>
        </Link>

        {/* 摘要 */}
        <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          {article.one_sentence_summary}
        </p>

        {/* 底部資訊列 */}
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
          <span className="max-w-[60%] truncate font-medium text-slate-600 dark:text-slate-300">
            {article.source_name}
          </span>
          <time dateTime={article.created_at}>{createdDate}</time>
        </div>
      </div>
    </article>
  );
}
