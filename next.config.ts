import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pg", "@prisma/client", "prisma"],
  experimental: {
    serverActions: {
      bodySizeLimit: "500mb",
    },
  },
};

export default nextConfig;
