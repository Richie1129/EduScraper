"use client";

import Link from "next/link";
import { useState } from "react";
import { FiArrowRight, FiHash, FiSearch } from "react-icons/fi";
import type { PopularTopicTag } from "@/lib/topicTags";

interface TopicDirectoryProps {
  topics: PopularTopicTag[];
}

export default function TopicDirectory({ topics }: TopicDirectoryProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredTopics = normalizedQuery
    ? topics.filter(({ label, value }) => {
        const searchable = `${label} ${value}`.toLowerCase();
        return searchable.includes(normalizedQuery);
      })
    : topics;

  const totalArticles = topics.reduce((sum, topic) => sum + topic.count, 0);

  return (
    <>
      <section className="mb-8 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_220px]">
        <label className="relative block">
          <span className="sr-only">搜尋主題</span>
          <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜尋主題名稱或 tag，例如 AI、assessment、learning design"
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-blue-500 dark:focus:ring-blue-500/10"
          />
        </label>

        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            主題總數
          </p>
          <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
            {topics.length}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            標籤累計次數
          </p>
          <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
            {totalArticles}
          </p>
        </div>
      </section>

      {filteredTopics.length > 0 ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTopics.map(({ value, label, href, count }) => (
            <Link
              key={value}
              href={href}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/40"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <FiHash className="h-3.5 w-3.5" aria-hidden="true" /> Topic
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-300">
                    {label}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    tag: {value}
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-200">
                  {count}
                </span>
              </div>
              <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition-colors group-hover:text-blue-600 dark:text-slate-300 dark:group-hover:text-blue-300">
                查看此主題文章
                <FiArrowRight className="h-4 w-4" aria-hidden="true" />
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-lg font-semibold text-slate-900 dark:text-white">
            找不到符合的主題
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            試試搜尋英文 tag、中文名稱，或清空搜尋條件重新瀏覽全部主題。
          </p>
        </div>
      )}
    </>
  );
}