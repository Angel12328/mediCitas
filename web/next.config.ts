import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "https://medicitas-api.onrender.com",
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/v1/:path+",
          destination: "https://medicitas-api.onrender.com/api/v1/:path+",
        },
      ],
    };
  },
};

export default nextConfig;
