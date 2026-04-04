import { getArticles } from "@/lib/supabase";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://eduinsight.tw";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const { articles } = await getArticles(1, 20);

  const items = articles
    .map((a) => {
      const pubDate = new Date(a.created_at).toUTCString();
      const tags = a.tags
        .map((t) => `<category>${escapeXml(t)}</category>`)
        .join("\n        ");

      return `    <item>
      <title>${escapeXml(a.translated_title)}</title>
      <link>${SITE_URL}/articles/${a.slug}</link>
      <guid isPermaLink="true">${SITE_URL}/articles/${a.slug}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(a.one_sentence_summary)}</description>
      <source url="${escapeXml(a.source_url)}">${escapeXml(a.source_name)}</source>
      ${tags}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>EduInsight｜教育科技研究速報</title>
    <link>${SITE_URL}</link>
    <description>每日精選全球最新教育科技、自主學習（SRL）與專題式學習（PBL）研究，以繁體中文 AI 摘要呈現。</description>
    <language>zh-TW</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/api/rss" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
