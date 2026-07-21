/**
 * Guarda de UX: nenhum window.confirm() nativo pode voltar ao código.
 *
 * O confirm() nativo some sem sinal em alguns contextos (iframe, alguns
 * navegadores mobile) e não combina com o visual do sistema. Todos os
 * "tem certeza?" passam pelo <ConfirmDialog>. Este teste varre o código-fonte
 * e falha se qualquer chamada a confirm( reaparecer.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const DIRS = ["app", "components", "hooks", "lib", "store"];
const IGNORE = new Set(["node_modules", ".next", "dist"]);
// O componente ConfirmDialog cita "window.confirm()" no comentário de doc —
// referência intencional, não uma chamada.
const ALLOWLIST = new Set(["components/ui/ConfirmDialog.tsx"]);

function walk(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (IGNORE.has(nome)) continue;
    const full = join(dir, nome);
    if (statSync(full).isDirectory()) {
      walk(full, acc);
    } else if (/\.(ts|tsx)$/.test(nome) && !/\.test\.(ts|tsx)$/.test(nome)) {
      acc.push(full);
    }
  }
  return acc;
}

describe("sem confirm() nativo no código-fonte", () => {
  it("nenhum arquivo chama window.confirm() nem confirm()", () => {
    const arquivos = DIRS.flatMap((d) => walk(join(ROOT, d)));
    // \bconfirm\( casa tanto "confirm(" quanto "window.confirm("
    const padrao = /\bconfirm\s*\(/;
    const ofensores = arquivos.filter((f) => {
      const rel = f.slice(ROOT.length + 1).replace(/\\/g, "/");
      if (ALLOWLIST.has(rel)) return false;
      return padrao.test(readFileSync(f, "utf8"));
    });
    expect(ofensores).toEqual([]);
  });
});
