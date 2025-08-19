import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, './'),
      '@/lib': path.resolve(__dirname, './lib'),
    };
    return config;
  },
};

export default nextConfig;
