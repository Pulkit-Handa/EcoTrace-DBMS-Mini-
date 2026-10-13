/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['mongoose', 'mongodb', 'pg'],
  poweredByHeader: false,
};

export default nextConfig;
