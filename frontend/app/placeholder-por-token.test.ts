/**
 * Guarda: nenhum placeholder com cor fixa, em tela nenhuma.
 *
 * UX-03. Já existia uma guarda para isto — `app/(auth)/tema-auth.test.tsx` —
 * e ela funciona: as telas de login e cadastro nunca regrediram. O problema é
 * que ela olha só as telas de auth, e o relatório de saúde, lendo o resultado
 * dela, concluiu que "sobrou 1" placeholder de cor fixa no projeto.
 *
 * Eram 42, em 20 arquivos. A varredura tinha sido feita num canto e o resto
 * nunca entrou na conta.
 *
 * Por que importa: `placeholder-slate-500` é um cinza fixo. No tema claro ele
 * fica quase invisível sobre fundo claro, e não acompanha a troca de tema nem
 * a paleta da empresa. `placeholder:text-muted-foreground` é token, e é o que
 * o `components/ui/input.tsx` do próprio projeto usa.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const DIRS = ["app", "components"];
const IGNORE = new Set(["node_modules", ".next", "dist"]);

/**
 * As utilidades de cor fixa de placeholder do Tailwind, em qualquer paleta e
 * qualquer intensidade: `placeholder-slate-500`, `placeholder-gray-400`,
 * `placeholder:text-zinc-500`... O token permitido não casa, porque
 * `muted-foreground` não é `<paleta>-<número>`.
 */
const COR_FIXA =
  /placeholder(?::text)?-(?:slate|gray|zinc|neutral|stone|white|black|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?\b/g;

const TOKEN = "placeholder:text-muted-foreground";

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

const COMO_CORRIGIR =
  `\n\n  Placeholder com cor fixa não acompanha a troca de tema: no claro o` +
  `\n  cinza escuro fica ilegível, e a paleta da empresa não o alcança.` +
  `\n  Troque por \`${TOKEN}\`, que é o que o` +
  `\n  components/ui/input.tsx do projeto já usa.\n`;

describe("placeholder vem do token", () => {
  it("nenhum arquivo usa cor fixa de placeholder", () => {
    const ofensores: string[] = [];
    for (const dir of DIRS) {
      for (const f of varrer(join(ROOT, dir))) {
        const achados = readFileSync(f, "utf8").match(COR_FIXA);
        if (achados) {
          const rel = f.slice(ROOT.length + 1).replace(/\\/g, "/");
          ofensores.push(`${rel} → ${[...new Set(achados)].join(", ")}`);
        }
      }
    }
    expect(ofensores.sort(), COMO_CORRIGIR).toEqual([]);
  });

  it("e o token continua em uso — a guarda não passa por ausência de inputs", () => {
    // Sem isto, apagar todos os placeholders do projeto deixaria o teste
    // verde, e ele afirmaria que a regra está cumprida quando não há regra a
    // cumprir.
    const comToken = DIRS.flatMap((d) => varrer(join(ROOT, d))).filter((f) =>
      readFileSync(f, "utf8").includes(TOKEN)
    );
    expect(comToken.length).toBeGreaterThan(20);
  });
});
