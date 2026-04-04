import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://eduinsight.tw"
  ),
  title: {
    default: "EduInsight｜教育科技研究速報",
    template: "%s｜EduInsight",
  },
  description:
    "每日精選全球最新教育科技、自主學習（SRL）與專題式學習（PBL）研究，以繁體中文 AI 摘要呈現，助力台灣教育工作者快速掌握前沿知識。",
  keywords: [
    "教育科技",
    "EdTech",
    "自主學習",
    "SRL",
    "PBL",
    "專題式學習",
    "學習科學",
    "學術研究",
    "教育創新",
    "知識翻新",
  ],
  openGraph: {
    type: "website",
    locale: "zh_TW",
    siteName: "EduInsight",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const adsenseId = process.env.NEXT_PUBLIC_ADSENSE_ID;
  const themeInitScript = `
    (() => {
      try {
        const storageKey = "eduinsight-theme";
        const stored = window.localStorage.getItem(storageKey);
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const theme = stored === "dark" || stored === "light" ? stored : (prefersDark ? "dark" : "light");
        document.documentElement.classList.toggle("dark", theme === "dark");
        document.documentElement.dataset.theme = theme;
      } catch (error) {
        document.documentElement.classList.remove("dark");
        document.documentElement.dataset.theme = "light";
      }
    })();
  `;

  return (
    <html lang="zh-TW" className={inter.variable} suppressHydrationWarning>
      <head>
        <link
          rel="alternate"
          type="application/rss+xml"
          title="EduInsight RSS"
          href="/api/rss"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {adsenseId && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseId}`}
            crossOrigin="anonymous"
            strategy="lazyOnload"
          />
        )}
      </head>
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
        <Header />
        <main className="flex-1 bg-slate-50 transition-colors duration-300 dark:bg-slate-950">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
