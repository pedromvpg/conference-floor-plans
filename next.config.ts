import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp"],
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  async redirects() {
    return [
      { source: "/e/:slug/assets", destination: "/e/:slug/library", permanent: false },
      { source: "/e/:slug/assets/sponsors", destination: "/e/:slug/sponsors", permanent: false },
      { source: "/e/:slug/assets/agenda", destination: "/e/:slug/agenda", permanent: false },
      { source: "/e/:slug/assets/library", destination: "/e/:slug/library", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/e/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
