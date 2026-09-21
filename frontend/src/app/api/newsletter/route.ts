import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";

// 簡易記憶體速率限制：每個 IP 每小時最多 5 次訂閱請求
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

const EMAIL_REGEX = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { message: "請求過於頻繁，請稍後再試。" },
      { status: 429 }
    );
  }

  let email: string;

  try {
    const body = await request.json();
    email = (body?.email ?? "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ message: "請求格式錯誤。" }, { status: 400 });
  }

  // 輸入驗證
  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      { message: "請輸入有效的電子郵件地址。" },
      { status: 400 }
    );
  }

  try {
    const pool = getPool();
    if (!pool) {
      throw new Error("DATABASE_URL 未設定");
    }

    // 重複訂閱視為重新啟用，不覆寫原本的 subscribed_at
    await pool.query(
      `INSERT INTO newsletter_subscribers (email, is_active)
       VALUES ($1, TRUE)
       ON CONFLICT (email) DO UPDATE SET is_active = TRUE`,
      [email]
    );

    return NextResponse.json({ message: "success" }, { status: 200 });
  } catch (err) {
    console.error("[Newsletter API] Unexpected error:", err);
    return NextResponse.json({ message: "伺服器錯誤。" }, { status: 500 });
  }
}
