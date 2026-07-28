/**
 * Regras puras do painel admin: indicador de saúde por último acesso e a trava
 * de 30 dias para exclusão.
 */
import { describe, it, expect } from "vitest";
import { saudePorUltimoAcesso, podeExcluir } from "./painel_admin";

const diasAtras = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString();

describe("saudePorUltimoAcesso", () => {
  it("verde para acesso recente (< 7 dias)", () => {
    expect(saudePorUltimoAcesso(diasAtras(2))).toBe("verde");
  });
  it("amarelo entre 7 e 30 dias", () => {
    expect(saudePorUltimoAcesso(diasAtras(15))).toBe("amarelo");
  });
  it("vermelho acima de 30 dias", () => {
    expect(saudePorUltimoAcesso(diasAtras(40))).toBe("vermelho");
  });
  it("vermelho quando nunca acessou (null)", () => {
    expect(saudePorUltimoAcesso(null)).toBe("vermelho");
  });
});

describe("podeExcluir", () => {
  it("não permite empresa ativa", () => {
    expect(podeExcluir("ativa", diasAtras(60))).toBe(false);
  });
  it("não permite suspensa há menos de 30 dias", () => {
    expect(podeExcluir("suspensa", diasAtras(10))).toBe(false);
  });
  it("permite suspensa há 30+ dias", () => {
    expect(podeExcluir("suspensa", diasAtras(31))).toBe(true);
  });
  it("não permite suspensa sem data", () => {
    expect(podeExcluir("suspensa", null)).toBe(false);
  });
});
