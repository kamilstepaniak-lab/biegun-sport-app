import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 30,
    },
  },
  turbopack: {},
};

export default nextConfig;
