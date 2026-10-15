/**
 * Guarda: nenhuma data de hoje nasce em UTC.
 *
 * B9. `new Date().toISOString().slice(0, 10)` parece "a data de hoje" e não é:
 * `toISOString` converte para UTC, e São Paulo é UTC−3. Das 21:00 à meia-noite
 * o atalho devolve **amanhã**.
 *
 * Não é hipótese. O `VendaForm` usava exatamente isso, e uma venda registrada
 * às 21:30 de 31/10 nascia com `data_venda = 2026-11-01` — mês errado. Dali
 * ela saía do filtro "hoje" da lista de vendas e, pelo lançamento financeiro
 * que herda `data_venda` como vencimento, entrava em novembro no fluxo de
 * caixa do dashboard.
 *
 * O helper certo é `hojeLocal()` de `@/lib/utils`, que lê o relógio local —
 * o mesmo dia que a pessoa vê no canto da tela. No backend o equivalente é
 * `timezone.localdate()`.
 *
 * ESTA GUARDA PROÍBE o recorte de data sobre `toISOString()`. Ela não proíbe
 * `toISOString()` em si: mandar um INSTANTE para o backend em UTC está certo
 * — é o que o formato existe para fazer. O defeito é cortar os 10 primeiros
 * caracteres dele e chamar o resultado de "a data de hoje".
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { hojeLocal } from "./utils";

const ROOT = join(__dirname, "..");
const DIRS = ["app", "components", "hooks", "lib", "store"];
const IGNORE = new Set(["node_modules", ".next", "dist"]);

/**
 * `toISOString()` seguido de recorte para "YYYY-MM-DD", nas duas formas que
 * o projeto usava: `.slice(0, 10)` e `.split("T")[0]`. Espaços e aspas
 * simples contam, para a forma não escapar pela formatação.
 */
const DATA_EM_UTC =
  /toISOString\(\)\s*\.\s*(?:slice\(\s*0\s*,\s*10\s*\)|split\(\s*["'`]T["'`]\s*\)\s*\[\s*0\s*\])/g;

interface Permitido {
  quantos: number;
  porque: string;
}

const ALLOWLIST: Record<string, Permitido> = {
  "lib/utils.ts": {
    quantos: 1,
    porque:
      "É o docstring de `hojeLocal`, mostrando o atalho errado para explicar " +
      "por que a função existe. Está num comentário, não em código — e tirá-lo " +
      "deixaria a próxima pessoa sem a razão.",
  },
};

function varrer(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (IGNORE.has(nome)) continue;
    const full = join(dir, nome);
    if (statSync(full).isDirectory()) {
      varrer(full, acc);
    } else if (/\.(ts|tsx)$/.test(nome) && !/\.test\.(ts|tsx)$/.test(nome)) {
      acc.push(full);
    }
  }
  return acc;
}

/** Arquivo → quantos recortes de data em UTC ele tem hoje. */
function levantamento(): Map<string, number> {
  const achados = new Map<string, number>();
  for (const dir of DIRS) {
    for (const f of varrer(join(ROOT, dir))) {
      const n = readFileSync(f, "utf8").match(DATA_EM_UTC)?.length ?? 0;
      if (n > 0) achados.set(f.slice(ROOT.length + 1).replace(/\\/g, "/"), n);
    }
  }
  return achados;
}

const COMO_CORRIGIR =
  "\n\n  `toISOString()` é UTC. Recortá-lo para YYYY-MM-DD devolve AMANHÃ" +
  "\n  das 21h à meia-noite em São Paulo — e vira o MÊS no dia 31." +
  "\n" +
  "\n  Para a data de hoje, use o helper:" +
  "\n" +
  "\n      import { hojeLocal } from \"@/lib/utils\";" +
  "\n      const quando = hojeLocal();" +
  "\n" +
  "\n  Para outra data local, monte dos componentes do relógio local" +
  "\n  (`getFullYear` / `getMonth` / `getDate`), nunca do ISO." +
  "\n" +
  "\n  Mandar um INSTANTE em UTC segue certo — o que esta guarda proíbe" +
  "\n  é cortar os 10 primeiros caracteres dele e chamar de data.\n";

describe("data de hoje não nasce em UTC", () => {
  it("nenhum arquivo fora da allowlist recorta data de um ISO", () => {
    const achados = levantamento();
    const ofensores = [...achados.entries()]
      .filter(([arquivo]) => !(arquivo in ALLOWLIST))
      .map(([arquivo, n]) => `${arquivo} (${n})`)
      .sort();

    expect(ofensores, COMO_CORRIGIR).toEqual([]);
  });

  it("arquivo da allowlist não ganha ocorrências novas de carona", () => {
    const achados = levantamento();
    const excedentes = [...achados.entries()]
      .filter(([a, n]) => a in ALLOWLIST && n > ALLOWLIST[a].quantos)
      .map(([a, n]) => `${a}: ${n}, allowlist permite ${ALLOWLIST[a].quantos}`)
      .sort();

    expect(excedentes, COMO_CORRIGIR).toEqual([]);
  });

  it("a allowlist não guarda entrada que já não descreve o código", () => {
    const achados = levantamento();
    const obsoletas = Object.keys(ALLOWLIST)
      .filter((a) => (achados.get(a) ?? 0) < ALLOWLIST[a].quantos)
      .sort();

    expect(
      obsoletas,
      "Têm MENOS ocorrências do que a allowlist declara — ajuste ou remova."
    ).toEqual([]);
  });

  it("toda entrada da allowlist explica a razão", () => {
    for (const [arquivo, { porque, quantos }] of Object.entries(ALLOWLIST)) {
      expect(quantos, `${arquivo}: quantos`).toBeGreaterThan(0);
      expect(porque.length, `${arquivo}: razão muito curta`).toBeGreaterThan(40);
    }
  });
});

// ════════════════════════════════════════════════════════════
// O helper que a guarda manda usar
// ════════════════════════════════════════════════════════════

describe("hojeLocal", () => {
  it("devolve o dia do relógio local, não o de UTC", () => {
    const agora = new Date();
    const esperado = [
      agora.getFullYear(),
      String(agora.getMonth() + 1).padStart(2, "0"),
      String(agora.getDate()).padStart(2, "0"),
    ].join("-");

    expect(hojeLocal()).toBe(esperado);
  });

  it("tem o formato que o backend espera", () => {
    expect(hojeLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("às 21:30 de 31/10 em São Paulo diverge do atalho antigo", () => {
    // O `vitest.config.ts` fixa TZ=America/Sao_Paulo, então esta comparação
    // mede o que a pessoa de verdade veria.
    const vi2130 = new Date("2026-10-31T21:30:00");
    const local = [
      vi2130.getFullYear(),
      String(vi2130.getMonth() + 1).padStart(2, "0"),
      String(vi2130.getDate()).padStart(2, "0"),
    ].join("-");

    expect(local).toBe("2026-10-31");
    // E o atalho que esta guarda proíbe teria dito outro mês.
    expect(vi2130.toISOString().slice(0, 10)).toBe("2026-11-01");
  });
});
