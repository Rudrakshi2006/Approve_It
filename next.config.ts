import type { NextConfig } from "next";

function getCspHeader(): string {
  const supabaseHost = process.env.SUPABASE_URL
    ? new URL(process.env.SUPABASE_URL).origin
    : "";
  const eklinkOrigin = process.env.EKLINK_URL
    ? new URL(process.env.EKLINK_URL).origin
    : "";

  const connectSrc = ["'self'", supabaseHost].filter(Boolean).join(" ");
  const imgSrc = ["'self'", "data:", "blob:", supabaseHost].filter(Boolean).join(" ");
  const formAction = ["'self'", eklinkOrigin].filter(Boolean).join(" ");

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'", // 'unsafe-inline' permitted for Next.js hydration with tracker note
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc}`,
    `connect-src ${connectSrc}`,
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    `form-action ${formAction}`,
    "frame-ancestors 'none'",
  ].join("; ");
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: getCspHeader() },
        ],
      },
      {
        // Cache-Control: no-store for all pages and APIs, but not _next/static
        source: "/((?!_next/static|_next/image|favicon.ico).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
