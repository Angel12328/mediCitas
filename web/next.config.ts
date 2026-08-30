import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
