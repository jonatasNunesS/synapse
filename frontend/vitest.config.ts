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
    // Fuso FIXO, igual ao do backend (`TIME_ZONE = "America/Sao_Paulo"`).
    //
    // Sem isto a suíte roda em UTC, e todo bug de fuso fica invisível: o
    // defeito que fazia data pura aparecer um dia antes só se manifesta em
    // fuso NEGATIVO. Em UTC, `new Date("2026-10-05")` é 5 de outubro mesmo,
    // então o teste passaria com o código errado — teste decorativo, pior que
    // nenhum, porque dá confiança falsa (CODE_HEALTH_AUDIT, ERR-03).
    //
    // Fixar também torna a suíte reprodutível: o mesmo teste passa na máquina
    // de quem desenvolve e no CI, qualquer que seja o fuso da máquina.
    env: { TZ: "America/Sao_Paulo" },
  },
});
