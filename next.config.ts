import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Disable runtime chunks that cause dynamic requires
    serverMinification: false,
    // Use edge-compatible runtime
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
