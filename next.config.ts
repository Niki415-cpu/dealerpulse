import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The floating dev badge is a Next.js development tool, not part of the product.
  devIndicators: false,
};

export default nextConfig;
