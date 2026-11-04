import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Letrado saiu de /games/termo; links antigos (convite de duelo, desafio) continuam valendo
    return [{ source: "/games/termo/:path*", destination: "/games/letrado/:path*", permanent: true }];
  },
};

export default nextConfig;
