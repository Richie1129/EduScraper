import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 使用 service role 金鑰寫入訂閱者（繞過 RLS），僅在伺服器端使用
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase 環境變數未設定");
  }
  return createClient(url, key);
}

const EMAIL_REGEX = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

export async function POST(request: NextRequest) {
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
    const supabase = getServiceClient();
    const { error } = await supabase
      .from("newsletter_subscribers")
      .upsert({ email, is_active: true }, { onConflict: "email" });

    if (error) {
      console.error("[Newsletter API] Supabase error:", error.message);
      return NextResponse.json(
        { message: "訂閱失敗，請稍後再試。" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "success" }, { status: 200 });
  } catch (err) {
    console.error("[Newsletter API] Unexpected error:", err);
    return NextResponse.json({ message: "伺服器錯誤。" }, { status: 500 });
  }
}
