import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Testes unitários: lógica pura (histórico do chat) + componentes React
// (ConfirmDialog). jsdom cobre ambos. Alias "@/..." espelha o tsconfig.
export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, ".") },
  },
  test: {
    include: ["**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
