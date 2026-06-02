import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true
  },
  images: {
    remotePatterns: [
      { hostname: '**.cdninstagram.com' },
      { hostname: '**.fbcdn.net' },
      { hostname: 'places.googleapis.com' },
      { hostname: '**.googleusercontent.com' },
      { hostname: '**.tiktokcdn.com' },
      { hostname: '**.tiktokcdn-us.com' },
      { hostname: 'ui-avatars.com' },
    ],
  },
};

export default nextConfig;
