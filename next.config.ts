import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 0,
    },
  },
  turbopack: {},
};

export default nextConfig;
