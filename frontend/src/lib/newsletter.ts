import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import type { Article } from "@/types/article";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://eduinsight.tw";
const FROM_EMAIL =
  process.env.NEWSLETTER_FROM_EMAIL ?? "EduInsight <newsletter@eduinsight.tw>";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY 未設定");
  return new Resend(key);
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase 環境變數未設定");
  return createClient(url, key);
}

/** 取得最近 N 天的已發布文章 */
export async function getRecentArticles(days = 7): Promise<Article[]> {
  const supabase = getServiceClient();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("is_published", true)
    .gte("created_at", since.toISOString())
    .order("relevance_score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) throw new Error(`取得文章失敗: ${error.message}`);
  return (data as Article[]) ?? [];
}

/** 取得所有活躍訂閱者的 email */
export async function getActiveSubscribers(): Promise<string[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("newsletter_subscribers")
    .select("email")
    .eq("is_active", true);

  if (error) throw new Error(`取得訂閱者失敗: ${error.message}`);
  return (data ?? []).map((row) => row.email);
}

/** 產生電子報 HTML */
export function buildNewsletterHtml(articles: Article[]): string {
  const dateStr = new Date().toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const articleBlocks = articles
    .map(
      (a) => `
    <tr>
      <td style="padding: 20px 0; border-bottom: 1px solid #e2e8f0;">
        <div style="margin-bottom: 6px;">
          ${a.tags
            .slice(0, 3)
            .map(
              (tag) =>
                `<span style="display: inline-block; background: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 9999px; margin-right: 4px;">${tag}</span>`
            )
            .join("")}
        </div>
        <a href="${SITE_URL}/articles/${a.slug}" style="color: #0f172a; font-size: 16px; font-weight: 700; text-decoration: none; line-height: 1.4;">
          ${a.translated_title}
        </a>
        <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 8px 0 0;">
          ${a.one_sentence_summary}
        </p>
      </td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; padding: 32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
          <td style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 32px 24px; text-align: center;">
            <h1 style="color: #ffffff; font-size: 24px; margin: 0 0 8px;">EduInsight 週報</h1>
            <p style="color: #bfdbfe; font-size: 14px; margin: 0;">${dateStr}</p>
          </td>
        </tr>
        <!-- Intro -->
        <tr>
          <td style="padding: 24px 24px 0;">
            <p style="color: #334155; font-size: 15px; line-height: 1.7; margin: 0;">
              本週精選 ${articles.length} 篇教育科技研究，依相關度排序。點擊標題閱讀完整 AI 摘要。
            </p>
          </td>
        </tr>
        <!-- Articles -->
        <tr>
          <td style="padding: 0 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${articleBlocks}
            </table>
          </td>
        </tr>
        <!-- CTA -->
        <tr>
          <td style="padding: 28px 24px; text-align: center;">
            <a href="${SITE_URL}" style="display: inline-block; background: #2563eb; color: #ffffff; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 8px; text-decoration: none;">
              前往網站瀏覽更多
            </a>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background: #f1f5f9; padding: 20px 24px; text-align: center;">
            <p style="color: #94a3b8; font-size: 12px; line-height: 1.6; margin: 0;">
              你收到此信是因為訂閱了 EduInsight 電子報。<br>
              AI 摘要僅供參考，完整資訊請閱讀原文。
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** 寄送電子報給所有活躍訂閱者 */
export async function sendNewsletter(): Promise<{
  sent: number;
  articleCount: number;
}> {
  const articles = await getRecentArticles(7);
  if (articles.length === 0) {
    return { sent: 0, articleCount: 0 };
  }

  const subscribers = await getActiveSubscribers();
  if (subscribers.length === 0) {
    return { sent: 0, articleCount: articles.length };
  }

  const resend = getResend();
  const html = buildNewsletterHtml(articles);
  const subject = `EduInsight 週報｜本週 ${articles.length} 篇精選教育科技研究`;

  // Resend batch API，一次最多 100 封
  const batches: string[][] = [];
  for (let i = 0; i < subscribers.length; i += 100) {
    batches.push(subscribers.slice(i, i + 100));
  }

  let sent = 0;
  for (const batch of batches) {
    const emails = batch.map((to) => ({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    }));

    const { data, error } = await resend.batch.send(emails);
    if (error) {
      console.error("[Newsletter] Resend batch error:", error);
    } else {
      sent += data?.data?.length ?? batch.length;
    }
  }

  return { sent, articleCount: articles.length };
}
