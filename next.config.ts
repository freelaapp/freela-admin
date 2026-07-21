import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      // `fallback`, e não a lista simples (que equivale a `afterFiles`): rewrites
      // de `afterFiles` são avaliados ANTES das rotas dinâmicas, então este
      // encaminhamento engolia o proxy `/api/fretes/[...path]` — a chamada saía
      // para o api-freela e voltava "Cannot GET /fretes/...". Em `fallback` ele
      // só age quando nada nesta app atendeu a rota, o que preserva o
      // comportamento antigo de todo o resto de `/api/*` e faz qualquer BFF
      // futuro funcionar sem mexer aqui de novo.
      fallback: [
        {
          source: "/api/:path*",
          destination: `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000"}/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
