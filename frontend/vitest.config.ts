import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Testes unitários: lógica pura + componentes React (jsdom cobre ambos).
// Alias "@/..." espelha o tsconfig para os imports funcionarem nos testes.
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
