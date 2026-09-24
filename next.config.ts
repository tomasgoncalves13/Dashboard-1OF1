import type { NextConfig } from "next";

const config: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  // O simulador do Plano Q4 é lido do disco pela rota /api/plano-q4.
  outputFileTracingIncludes: { "/api/plano-q4": ["./src/lib/dashboard/plano-q4.html"] },
  experimental: {
    serverActions: { bodySizeLimit: "10mb", allowedOrigins: ["localhost:3000"] },
  },
};

export default config;
