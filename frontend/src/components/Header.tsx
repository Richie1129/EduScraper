"use client";

import Link from "next/link";
import { useState } from "react";
import { FiBook, FiMenu, FiX } from "react-icons/fi";

const NAV_LINKS = [
  { href: "/", label: "最新研究" },
  { href: "/?tag=SRL", label: "自主學習" },
  { href: "/?tag=PBL", label: "專題學習" },
  { href: "/?tag=AI", label: "AI 教育" },
  { href: "/?tag=edtech", label: "EdTech" },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <FiBook className="w-6 h-6 text-blue-600" aria-hidden="true" />
            <span className="text-xl font-extrabold text-gray-900 tracking-tight">
              EduInsight
            </span>
          </Link>

          {/* 桌面導覽 */}
          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-gray-600 hover:text-blue-600 transition-colors font-medium text-sm"
              >
                {label}
              </Link>
            ))}
          </div>

          {/* 手機選單按鈕 */}
          <button
            type="button"
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "關閉選單" : "開啟選單"}
          >
            {mobileOpen ? (
              <FiX className="w-6 h-6" aria-hidden="true" />
            ) : (
              <FiMenu className="w-6 h-6" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* 手機展開選單 */}
        {mobileOpen && (
          <div className="md:hidden py-4 border-t border-gray-100">
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="px-2 py-2.5 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium text-sm"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
