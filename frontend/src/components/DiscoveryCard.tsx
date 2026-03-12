import Link from "next/link";
import type { DiscoveryReport } from "@/types/discovery";

interface DiscoveryCardProps {
  report: DiscoveryReport;
}

export default function DiscoveryCard({ report }: DiscoveryCardProps) {
  const coverageDate = new Date(report.coverage_date).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <article className="rounded-[28px] border border-stone-200 bg-white/90 p-6 shadow-[0_18px_50px_-24px_rgba(28,25,23,0.35)] transition-transform duration-200 hover:-translate-y-1">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
          Discovery
        </span>
        <span className="text-xs font-medium text-stone-500">{coverageDate}</span>
      </div>

      <Link href={`/discoveries/${report.slug}`} className="group block">
        <h2 className="text-xl font-bold leading-snug text-stone-900 transition-colors group-hover:text-amber-700">
          {report.title}
        </h2>
      </Link>

      <p className="mt-3 line-clamp-3 text-sm leading-7 text-stone-600">
        {report.summary}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {report.tags.slice(0, 4).map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-600"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-4 text-xs text-stone-500">
        <span>{report.topic}</span>
        <span>{report.source_count} 個來源</span>
      </div>
    </article>
  );
}