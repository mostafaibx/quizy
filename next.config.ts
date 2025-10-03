import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  experimental: {
    // Disable runtime chunks that cause dynamic requires
    serverMinification: false,
    // Use edge-compatible runtime
    serverActions: {
      bodySizeLimit: "2mb",
      allowedOrigins: ["localhost:3000", "http://localhost:3000"],
    },
  },
};

export default withNextIntl(nextConfig);
