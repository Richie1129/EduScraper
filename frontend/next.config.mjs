/** @type {import('next').NextConfig} */
const nextConfig = {
  // ISR 與 SSG 由各頁面的 revalidate 控制
  // 若需要完全靜態匯出，可取消下列注釋：
  // output: "export",

  // 允許在驗證或特殊部署情境下切換建構輸出目錄，避開被污染的 .next。
  distDir: process.env.NEXT_DIST_DIR || ".next",

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.google.com",
        pathname: "/s2/favicons/**",
      },
    ],
  },

  // 安全性 HTTP Headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js 需要 unsafe-inline / unsafe-eval；AdSense 需要額外來源
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://adservice.google.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co",
              "frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
