import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Permite o build mesmo com erros de ESLint
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Permite o build mesmo com erros de TypeScript  
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
