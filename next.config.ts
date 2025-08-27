// SUBSTITUA o arquivo next.config.js por esta versão:

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
  },
  webpack: (config: { resolve: { alias: { canvas: boolean; encoding: boolean; }; }; }) => {
    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    return config;
  },
  eslint: {
    ignoreDuringBuilds: true, // IGNORA ESLINT NO BUILD
  },
  typescript: {
    ignoreBuildErrors: false, // MANTÉM VERIFICAÇÃO TYPESCRIPT
  },
}

module.exports = nextConfig