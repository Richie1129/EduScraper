"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { FiBook, FiMenu, FiSearch, FiX } from "react-icons/fi";
import ThemeToggle from "@/components/ThemeToggle";

const NAV_LINKS = [
  { href: "/", label: "最新研究" },
  { href: "/discoveries", label: "新聞統整" },
  { href: "/topics", label: "全部主題" },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/92 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/92">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <FiBook className="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              EduInsight
            </span>
          </Link>

          {/* 桌面導覽 */}
          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                className={`rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                  pathname === href
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200"
                    : "text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-300"
                }`}
              >
                {label}
              </Link>
            ))}
            <Link
              href="/search"
              aria-label="搜尋文章"
              className="rounded-full p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-blue-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300"
            >
              <FiSearch className="h-5 w-5" aria-hidden="true" />
            </Link>
            <ThemeToggle />
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <button
              type="button"
              className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "關閉選單" : "開啟選單"}
            >
              {mobileOpen ? (
                <FiX className="h-6 w-6" aria-hidden="true" />
              ) : (
                <FiMenu className="h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* 手機展開選單 */}
        {mobileOpen && (
          <div className="border-t border-slate-100 py-4 dark:border-slate-800 md:hidden">
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={pathname === href ? "page" : undefined}
                  className={`rounded-lg px-2 py-2.5 text-sm font-medium transition-colors ${
                    pathname === href
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200"
                      : "text-slate-700 hover:bg-blue-50 hover:text-blue-600 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-blue-300"
                  }`}
                >
                  {label}
                </Link>
              ))}
              <Link
                href="/search"
                className={`flex items-center gap-2 rounded-lg px-2 py-2.5 text-sm font-medium transition-colors ${
                  pathname === "/search"
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200"
                    : "text-slate-700 hover:bg-blue-50 hover:text-blue-600 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-blue-300"
                }`}
              >
                <FiSearch className="h-4 w-4" aria-hidden="true" />
                搜尋文章
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
