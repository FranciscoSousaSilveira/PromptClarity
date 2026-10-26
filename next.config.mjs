/** @type {import('next').NextConfig} */
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: __dirname,
  pageExtensions: ['ts', 'tsx', 'js', 'jsx'],
  // Exclude desktop app from Next.js build
  webpack: (config) => {
    config.module.rules.push({
      test: /apps[\\/]desktop-app/,
      loader: 'ignore-loader'
    });
    return config;
  }
};

export default nextConfig;
