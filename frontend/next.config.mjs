/** @type {import('next').NextConfig} */
const nextConfig = {
  // ISR 與 SSG 由各頁面的 revalidate 控制
  // 若需要完全靜態匯出，可取消下列注釋：
  // output: "export",

  images: {
    remotePatterns: [],
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
        ],
      },
    ];
  },
};

export default nextConfig;
