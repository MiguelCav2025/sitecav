import type { NextConfig } from "next";

// ATENCAO: este e o unico arquivo de config do Next neste projeto.
// O Next resolve na ordem next.config.js > next.config.mjs > next.config.ts e
// usa apenas o primeiro que encontrar. Existia tambem um next.config.mjs, que
// vencia e fazia esta config inteira ser ignorada. Nao recriar o .mjs.
const nextConfig: NextConfig = {
  // Mantem mammoth e pdf-parse fora do bundle do servidor. Sem isso o build
  // acusa "Module not found: ./lib/pdf-parse.js is not exported" na rota
  // /api/admin/parse-results.
  serverExternalPackages: ["mammoth", "pdf-parse"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "via.placeholder.com",
      },
      {
        protocol: "https",
        hostname: "ogxibzrrfnykfaueinsl.supabase.co",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
      },
    ],
  },
};

export default nextConfig;
