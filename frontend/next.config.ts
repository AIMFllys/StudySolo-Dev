import type { NextConfig } from "next";

const BACKEND_URL =
  process.env.INTERNAL_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:2038";

const normalizedBackendUrl = BACKEND_URL.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${normalizedBackendUrl}/api/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      {
        // Redirect old /workspace/{uuid} to /c/{uuid} — preserves /workspace (list page)
        source: "/workspace/:id([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})",
        destination: "/c/:id",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
