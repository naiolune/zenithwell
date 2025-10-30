import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Allow requests from zenithwell.online
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
