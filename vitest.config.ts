import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // O tsconfig do Next usa `jsx: "preserve"`, e o esbuild do Vitest cai no modo
  // clássico quando encontra isso: todo componente precisaria de um
  // `import * as React` só para o teste rodar, mesmo o app não precisando.
  // Fixar o runtime automático aqui faz o teste compilar como o app compila.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./vitest.setup.ts",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
