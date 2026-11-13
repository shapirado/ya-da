import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '8mb' }, // payment screenshots
  },
};

export default nextConfig;
