import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Testes unitários de lógica pura (ex.: histórico local do chat).
// Alias "@/..." espelha o tsconfig para os imports funcionarem nos testes.
export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, ".") },
  },
  test: {
    include: ["**/*.test.ts"],
    environment: "node",
  },
});
