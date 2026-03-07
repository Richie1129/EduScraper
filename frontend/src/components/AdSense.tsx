"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

interface AdSenseProps {
  /** AdSense 廣告單元 ID（在 AdSense 控制台建立廣告單元後取得） */
  slot: string;
  format?: "auto" | "fluid" | "rectangle" | "vertical" | "horizontal";
  className?: string;
}

/**
 * Google AdSense 廣告元件。
 * - 設定 NEXT_PUBLIC_ADSENSE_ID 環境變數後自動啟用。
 * - 未設定時顯示開發佔位符，方便版面設計預覽。
 */
export default function AdSense({
  slot,
  format = "auto",
  className = "",
}: AdSenseProps) {
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_ID;

  useEffect(() => {
    if (!clientId) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.error("[AdSense]", err);
    }
  }, [clientId]);

  if (!clientId) {
    // 開發模式下的佔位框
    return (
      <div
        className={`my-6 py-6 bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center ${className}`}
        aria-hidden="true"
      >
        <p className="text-gray-400 text-sm font-medium">
          廣告位置（AdSense・設定 NEXT_PUBLIC_ADSENSE_ID 後啟用）
        </p>
      </div>
    );
  }

  return (
    <div className={`my-6 overflow-hidden ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={clientId}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
