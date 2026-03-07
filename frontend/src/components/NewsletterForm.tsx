"use client";

import { useState } from "react";
import { FiMail, FiCheckCircle } from "react-icons/fi";

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setMessage("訂閱成功！感謝您的加入，我們將每週寄送精選研究給您。");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data?.message ?? "訂閱失敗，請稍後再試。");
      }
    } catch {
      setStatus("error");
      setMessage("網路錯誤，請稍後再試。");
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-8 text-white">
      <div className="text-center mb-6">
        <FiMail className="w-10 h-10 mx-auto mb-2 text-blue-200" aria-hidden="true" />
        <h2 className="text-2xl font-extrabold mb-2">每週精選研究電子報</h2>
        <p className="text-blue-100 text-sm leading-relaxed max-w-md mx-auto">
          每週五信箱收到精選 5 篇教育科技重點研究摘要，零時間壓力掌握學術前沿。
        </p>
      </div>

      {status === "success" ? (
        <div className="text-center py-4">
          <p className="text-green-200 font-semibold text-lg flex items-center justify-center gap-2">
            <FiCheckCircle aria-hidden="true" /> {message}
          </p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
        >
          <label htmlFor="newsletter-email" className="sr-only">
            電子郵件地址
          </label>
          <input
            id="newsletter-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            disabled={status === "loading"}
            className="flex-1 px-4 py-3 rounded-xl bg-white/20 text-white placeholder-blue-200 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/60 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="px-6 py-3 bg-white text-blue-700 font-bold rounded-xl hover:bg-blue-50 active:scale-95 transition-all disabled:opacity-60 whitespace-nowrap"
          >
            {status === "loading" ? "訂閱中…" : "免費訂閱"}
          </button>
        </form>
      )}

      {status === "error" && (
        <p className="text-center text-red-200 mt-3 text-sm">{message}</p>
      )}
    </div>
  );
}
