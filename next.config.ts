import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "@prisma/adapter-pg", "@prisma/client"],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/tpao-teklif.html", destination: "/tpao-teklif" },
        { source: "/katalog.html", destination: "/katalog" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
