import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "@prisma/adapter-pg", "@prisma/client"],
  outputFileTracingIncludes: {
    "/tpao-teklif": ["./private/**/*"],
    "/katalog": ["./private/**/*"],
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "audiob2b-audio-files.s3.eu-central-1.amazonaws.com",
        pathname: "/covers/**",
      },
      {
        protocol: "https",
        hostname: "dj37r9f1t56v.cloudfront.net",
      },
    ],
  },
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
