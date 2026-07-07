import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output produces a self-contained server bundle for the Docker image.
  output: "standalone",
  compiler: {
    removeConsole: { exclude: ["error", "warn"] },
  },
  // API_PROXY_TARGET is read at server start (not build), so one prebuilt image
  // can proxy same-origin /api/* calls to whatever backend the deployment names.
  async rewrites() {
    const target = process.env.API_PROXY_TARGET?.replace(/\/$/, "");
    if (!target) {
      return [];
    }
    return [{ source: "/api/:path*", destination: `${target}/api/:path*` }];
  },
};

export default nextConfig;
