import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    // ✅ Ignora erros do ESLint no deploy
    ignoreDuringBuilds: true,
  },
  typescript: {
    // ✅ Ignora erros de TypeScript no deploy
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
