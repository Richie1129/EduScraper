import { FiInfo, FiZap } from "react-icons/fi";
import type { AIHighlight } from "@/types/article";

interface AIHighlightsProps {
  highlights: AIHighlight[];
}

export default function AIHighlights({ highlights }: AIHighlightsProps) {
  if (highlights.length === 0) {
    return null;
  }

  return (
    <section className="mb-10" aria-labelledby="ai-highlights-heading">
      <div className="mb-5 flex items-center gap-2">
        <FiZap className="h-5 w-5 text-violet-600 dark:text-violet-300" aria-hidden="true" />
        <h2 id="ai-highlights-heading" className="text-xl font-bold text-slate-900 dark:text-white">
          AI 幫你先抓重點
        </h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {highlights.map((highlight, index) => (
          <div
            key={`${highlight.point}-${index}`}
            tabIndex={0}
            className="group relative rounded-2xl border border-violet-200 bg-violet-50/80 p-5 outline-none transition-colors hover:border-violet-300 dark:border-violet-500/20 dark:bg-violet-500/10 dark:hover:border-violet-400/40"
          >
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-700 dark:bg-slate-900 dark:text-violet-200">
              <FiZap className="h-3.5 w-3.5" aria-hidden="true" /> AI 重點 {index + 1}
            </div>

            <p className="text-sm font-semibold leading-7 text-slate-900 dark:text-violet-50">
              {highlight.point}
            </p>

            <div className="mt-4 flex items-center gap-2 text-xs font-medium text-violet-700 dark:text-violet-200">
              <FiInfo className="h-3.5 w-3.5" aria-hidden="true" />
              <span>滑鼠懸停看 AI 判斷理由</span>
            </div>

            <div className="mt-3 rounded-xl border border-violet-200/70 bg-white/80 p-4 text-sm leading-6 text-slate-700 dark:border-violet-400/20 dark:bg-slate-900/70 dark:text-slate-300 md:hidden">
              {highlight.reason}
            </div>

            <div className="pointer-events-none absolute left-0 right-0 top-full z-20 mt-3 hidden rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700 shadow-[0_22px_70px_-30px_rgba(15,23,42,0.45)] md:group-hover:block md:group-focus:block dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-200">
                <FiInfo className="h-3.5 w-3.5" aria-hidden="true" /> AI 判斷理由
              </div>
              <p>{highlight.reason}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}