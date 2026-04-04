import { NextRequest, NextResponse } from "next/server";
import { sendNewsletter } from "@/lib/newsletter";

/**
 * POST /api/newsletter/send
 * 手動或排程觸發電子報寄送。需要 NEWSLETTER_SECRET 驗證。
 */
export async function POST(request: NextRequest) {
  const secret = process.env.NEWSLETTER_SECRET;
  if (!secret) {
    return NextResponse.json(
      { message: "NEWSLETTER_SECRET 未設定" },
      { status: 500 }
    );
  }

  // 從 header 或 body 取得 token
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (token !== secret) {
    return NextResponse.json({ message: "未授權" }, { status: 401 });
  }

  try {
    const result = await sendNewsletter();

    if (result.articleCount === 0) {
      return NextResponse.json(
        { message: "本週無新文章，跳過寄送", ...result },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { message: `成功寄送 ${result.sent} 封電子報`, ...result },
      { status: 200 }
    );
  } catch (err) {
    console.error("[Newsletter Send] Error:", err);
    return NextResponse.json(
      { message: "寄送失敗", error: String(err) },
      { status: 500 }
    );
  }
}
