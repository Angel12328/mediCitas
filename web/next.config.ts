import type { NextConfig } from "next";

const apiUrl = process.env.API_URL || "https://medicitas-api.onrender.com";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/api/v1/:path+",
          destination: `${apiUrl}/api/v1/:path+`,
        },
      ],
    };
  },
};

export default nextConfig;
