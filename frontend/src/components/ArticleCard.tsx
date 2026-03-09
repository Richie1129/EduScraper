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
    <article className="bg-white rounded-2xl shadow-sm border border-gray-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col">
      <div className="p-6 flex flex-col flex-1">
        {/* 標籤列 */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {article.tags.slice(0, 3).map((tag) => (
            <Link
              key={tag}
              href={`/?tag=${encodeURIComponent(tag)}`}
              className="text-xs font-semibold px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors"
            >
              {tag}
            </Link>
          ))}
        </div>

        {/* 標題 */}
        <Link href={`/articles/${article.slug}`} className="group mb-2">
          <h2 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug">
            {article.translated_title}
          </h2>
        </Link>

        {/* 摘要 */}
        <p className="text-gray-500 text-sm leading-relaxed flex-1 line-clamp-3">
          {article.one_sentence_summary}
        </p>

        {/* 底部資訊列 */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400 gap-3">
          <span className="font-medium text-gray-600 truncate max-w-[60%]">
            {article.source_name}
          </span>
          <time dateTime={article.created_at}>{createdDate}</time>
        </div>
      </div>
    </article>
  );
}
