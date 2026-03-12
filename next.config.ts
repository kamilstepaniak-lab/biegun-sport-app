import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
    optimizePackageImports: ['lucide-react', 'date-fns', '@supabase/ssr'],
  },
  turbopack: {},
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
