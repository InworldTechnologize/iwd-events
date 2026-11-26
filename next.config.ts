import type { NextConfig } from 'next';

const config: NextConfig = {
  poweredByHeader: false,
  compress: true,
  serverExternalPackages: ['postgres', 'ioredis'],
};

export default config;
