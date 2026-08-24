/**
 * Formatação de dinheiro.
 *
 * O helper canônico devolvia "R$ NaN" para entrada inválida e só aceitava
 * `number` — enquanto a API manda decimal como string. Cada tela resolveu
 * isso por conta própria: 14 cópias, com 5 comportamentos diferentes para
 * o mesmo caso (INC-03 / COD-02 do QUALITY_AUDIT.md).
 *
 * A regra que estes testes fixam: zero é informação e sai como "R$ 0,00";
 * ausência é outra coisa e sai como "—". Nunca "R$ NaN", e nunca um zero
 * inventado no lugar de um dado que se perdeu.
 */
import { describe, it, expect } from "vitest";

import { formatCurrency, formatCurrencyOrNull, SEM_VALOR } from "./utils";

/**
 * O Intl separa "R$" do número com espaço não-quebrável (U+00A0), não com
 * espaço comum. Normalizar deixa a intenção do teste legível.
 */
const brl = (v: unknown, o?: { compacto?: boolean }) =>
  formatCurrency(v, o).replace(/\u00a0/g, " ");
const brlOuNulo = (v: unknown) => {
  const r = formatCurrencyOrNull(v);
  return r === null ? null : r.replace(/\u00a0/g, " ");
};

describe("formatCurrency — valores válidos", () => {
  it("formata número", () => {
    expect(brl(1234.5)).toBe("R$ 1.234,50");
  });

  it("formata string, que é como a API manda decimal", () => {
    expect(brl("1234.50")).toBe("R$ 1.234,50");
  });

  it("zero legítimo sai como R$ 0,00, não como ausente", () => {
    expect(brl(0)).toBe("R$ 0,00");
    expect(brl("0")).toBe("R$ 0,00");
    expect(brl("0.00")).toBe("R$ 0,00");
  });

  it("negativo mantém o sinal", () => {
    expect(formatCurrency(-50)).toContain("50,00");
    expect(formatCurrency(-50)).toMatch(/-/);
  });

  it("compacto encurta números grandes", () => {
    const compacto = brl(1200, { compacto: true });
    expect(compacto).toMatch(/mil/i);
    expect(compacto).not.toBe("R$ 1.200,00");
  });
});

describe("formatCurrency — nunca R$ NaN", () => {
  it.each([
    ["undefined", undefined],
    ["null", null],
    ["string vazia", ""],
    ["texto não numérico", "abc"],
    ["NaN", NaN],
    ["Infinity", Infinity],
    ["objeto", {}],
  ])("%s vira a marca de ausente", (_caso, entrada) => {
    const saida = formatCurrency(entrada);
    expect(saida).toBe(SEM_VALOR);
    expect(saida).not.toContain("NaN");
  });

  it("ausência NÃO é confundida com zero", () => {
    // A distinção é o ponto: um zero inventado esconderia o dado perdido.
    expect(formatCurrency(undefined)).not.toBe(formatCurrency(0));
  });
});

describe("formatCurrencyOrNull", () => {
  it("devolve null quando não há valor, para quem prefere não renderizar", () => {
    expect(formatCurrencyOrNull(null)).toBeNull();
    expect(formatCurrencyOrNull(undefined)).toBeNull();
    expect(formatCurrencyOrNull("")).toBeNull();
    expect(formatCurrencyOrNull("abc")).toBeNull();
  });

  it("formata igual ao formatCurrency quando há valor", () => {
    expect(brlOuNulo("1234.50")).toBe("R$ 1.234,50");
    expect(brlOuNulo(0)).toBe("R$ 0,00");
  });
});

describe("Comportamentos que as cópias cobriam", () => {
  it("string decimal do DRF — o caso das cópias de fornecedores e clientes", () => {
    expect(brl("0.00")).toBe("R$ 0,00");
    expect(brl("99999.99")).toBe("R$ 99.999,99");
  });

  it("o antigo `num || 0` transformava inválido em zero; agora fica visível", () => {
    // As cópias de clientes faziam `format(num || 0)`, então um valor
    // ilegível virava "R$ 0,00" e passava por movimento real.
    expect(formatCurrency("abc")).toBe(SEM_VALOR);
  });

  it("milhar e centavos sempre presentes no formato longo", () => {
    expect(brl(1000)).toBe("R$ 1.000,00");
  });
});
