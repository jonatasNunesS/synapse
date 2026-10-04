/**
 * Formatação de data (CODE_HEALTH_AUDIT, ERR-03).
 *
 * O defeito: `formatDate` fazia `new Date(string)`, e para uma DATA PURA
 * ("2026-10-05" — o que o DRF serializa de um `DateField`) isso é meia-noite
 * **UTC**. Em São Paulo (UTC−3) vira 21h do dia ANTERIOR:
 *
 *     "2026-10-05"  →  04/10/2026   (um dia antes)
 *     "2026-01-01"  →  31/12/2025   (um dia E um ano antes)
 *
 * Atingia vencimento financeiro e follow-up no dashboard. Nove lugares no
 * código contornavam à mão, de três maneiras diferentes, e a origem nunca
 * tinha sido corrigida.
 *
 * ⚠️ Estes testes só têm valor com o FUSO FIXADO em `America/Sao_Paulo`
 * (`vitest.config.ts`). Em UTC o bug não se manifesta, e eles passariam com
 * o código errado — o primeiro teste abaixo existe para garantir isso.
 */
import { describe, it, expect } from "vitest";

import {
  formatDate,
  formatDateDiaMes,
  formatDateDiaMesAbrev,
  formatDateDiaMesHora,
  formatDateDiaMesLongo,
  formatDateTime,
  formatTime,
  paraData,
} from "./utils";

describe("A suíte roda no fuso que expõe o bug", () => {
  it("o fuso é America/Sao_Paulo, não UTC", () => {
    // Sem esta garantia, todo teste abaixo é decorativo.
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(
      "America/Sao_Paulo"
    );
  });

  it("o offset é negativo, que é a condição do defeito", () => {
    // `getTimezoneOffset` é positivo a oeste de Greenwich.
    expect(new Date("2026-10-05T12:00:00Z").getTimezoneOffset()).toBeGreaterThan(0);
  });
});

describe("Data pura não desloca o dia", () => {
  it('"2026-01-01" é 01/01/2026 — não 31/12/2025', () => {
    // O caso mais revelador: errava o dia, o mês E o ano de uma vez.
    expect(formatDate("2026-01-01")).toBe("01/01/2026");
  });

  it('"2026-10-05" é 05/10/2026 — não 04/10/2026', () => {
    expect(formatDate("2026-10-05")).toBe("05/10/2026");
  });

  it("o primeiro dia de cada mês não cai no mês anterior", () => {
    const meses = [
      ["2026-02-01", "01/02/2026"],
      ["2026-03-01", "01/03/2026"],
      ["2026-07-01", "01/07/2026"],
      ["2026-12-01", "01/12/2026"],
    ] as const;

    for (const [entrada, esperado] of meses) {
      expect(formatDate(entrada), `entrada ${entrada}`).toBe(esperado);
    }
  });

  it("29 de fevereiro de ano bissexto sobrevive", () => {
    expect(formatDate("2028-02-29")).toBe("29/02/2028");
  });
});

describe("String com hora continua como era", () => {
  it("ISO com Z é convertido para o fuso local, como antes", () => {
    // 14h UTC = 11h em São Paulo, mesmo dia.
    expect(formatDate("2026-10-05T14:00:00Z")).toBe("05/10/2026");
  });

  it("ISO perto da meia-noite UTC cai no dia anterior — e está CERTO", () => {
    // Aqui o deslocamento é correto: é um INSTANTE, e 01h UTC do dia 5 é
    // mesmo 22h do dia 4 em São Paulo. A correção não pode ter mexido nisto.
    expect(formatDate("2026-10-05T01:00:00Z")).toBe("04/10/2026");
  });

  it("formatDateTime mostra a hora de uma ISO completa", () => {
    expect(formatDateTime("2026-10-05T14:30:00Z")).toBe("05/10/2026, 11:30");
  });
});

describe("formatDateTime numa data pura", () => {
  it("mostra só a data, sem inventar 00:00", () => {
    // Uma data pura não carrega hora; exibir "00:00" afirmaria uma precisão
    // que o dado não tem.
    expect(formatDateTime("2026-10-05")).toBe("05/10/2026");
  });
});

describe("paraData", () => {
  it("data pura nasce à meia-noite LOCAL", () => {
    const d = paraData("2026-10-05");

    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9); // outubro é 9
    expect(d.getDate()).toBe(5);
    expect(d.getHours()).toBe(0);
  });

  it("um Date passa direto, sem recriação", () => {
    const original = new Date("2026-10-05T14:00:00Z");

    expect(paraData(original)).toBe(original);
  });

  it("string que não é data pura não é tratada como tal", () => {
    // Com parte de hora, o fuso tem sentido e o parse normal vale.
    expect(paraData("2026-10-05T00:00:00Z").getTime()).toBe(
      new Date("2026-10-05T00:00:00Z").getTime()
    );
  });
});

describe("As variantes preservam o formato que as telas já mostravam", () => {
  // Fixa a SAÍDA de cada variante. É o que garante que a migração dos 42
  // arquivos não mudou nada visível — só corrigiu o valor onde estava errado.
  const casos: [string, (d: string) => string, string][] = [
    ["formatDate", formatDate, "05/10/2026"],
    ["formatDateDiaMes", formatDateDiaMes, "05/10"],
    ["formatDateDiaMesAbrev", formatDateDiaMesAbrev, "05 de out."],
    ["formatDateDiaMesLongo", formatDateDiaMesLongo, "05 de outubro"],
  ];

  for (const [nome, fn, esperado] of casos) {
    it(`${nome} em data pura → "${esperado}"`, () => {
      expect(fn("2026-10-05")).toBe(esperado);
    });
  }

  it("todas as variantes tratam data pura sem deslocar o dia", () => {
    // A virada de ano é o caso que mais revela: um dia a menos erra o ano.
    for (const [nome, fn] of casos) {
      expect(fn("2026-01-01"), `${nome} em 2026-01-01`).not.toContain("2025");
      expect(fn("2026-01-01"), `${nome} em 2026-01-01`).toMatch(/01|jan/);
    }
  });

  it("formatDateDiaMesHora mostra dia, mês e hora de uma ISO", () => {
    expect(formatDateDiaMesHora("2026-10-05T14:30:00Z")).toBe("05 de out., 11:30");
  });

  it("formatTime mostra só a hora, no fuso local", () => {
    expect(formatTime("2026-10-05T14:30:00Z")).toBe("11:30");
  });
});
