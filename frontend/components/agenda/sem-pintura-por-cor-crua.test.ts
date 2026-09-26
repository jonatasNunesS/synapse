/**
 * Guarda: nenhum componente pinta um evento com a cor CRUA (`evento.cor`).
 *
 * Desde as categorias, a cor do evento sai de `cor_efetiva` — categoria quando
 * há uma, senão a cor livre antiga. `cor` continua existindo só como fallback
 * histórico, e o backend já o resolve. Pintar com `.cor` direto faria um evento
 * categorizado aparecer na cor antiga dele: a tela mostraria uma cor, a legenda
 * mostraria outra, e o bug seria silencioso.
 *
 * Este teste varre o código-fonte e falha se voltar a existir uma pintura a
 * partir de `algumaCoisa.cor` num arquivo que mexe com evento de agenda.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const DIRS = ["app", "components", "hooks"];
const IGNORE = new Set(["node_modules", ".next", "dist"]);

/**
 * Só interessam arquivos que lidam com evento de agenda: `projeto.cor` e
 * `caixinha.cor` são de outros módulos, que não têm categoria e pintam mesmo
 * pela própria cor.
 */
const PADRAO_EVENTO = /\bEvento\b|\bCompromissoItem\b|@\/types\/agenda/;

/**
 * Pintura: `backgroundColor: x.cor`, `background: a.b.cor`, `borderTopColor`,
 * `fill=`. O caminho pode ser pontuado (`item.resource.cor` era exatamente o
 * jeito como o calendário pintava), então o que interessa é o DONO do `.cor`:
 * o último segmento antes dele.
 */
const PADRAO_PINTURA =
  /(?:backgroundColor|background|borderTopColor|borderColor|fill|color)\s*[:=]\s*\{?\s*(?:[A-Za-z_$][\w$]*\??\.)*([A-Za-z_$][\w$]*)\??\.cor\b/g;

/**
 * Donos cujo `.cor` é a própria fonte da verdade: a categoria e o item já
 * montado da legenda. Pintar a partir deles está certo.
 */
const DONOS_LEGITIMOS = new Set(["cat", "categoria", "opcao", "item"]);

/** Achou pintura a partir da cor crua de um evento? */
export function pintaCorCrua(fonte: string): boolean {
  for (const m of fonte.matchAll(PADRAO_PINTURA)) {
    if (!DONOS_LEGITIMOS.has(m[1])) return true;
  }
  return false;
}

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

/**
 * A exceção consciente: o payload do dashboard já chega com `cor_efetiva`
 * resolvido pelo backend sob a chave `cor` (ver `CompromissoItem`), então este
 * widget pinta certo pintando `c.cor`.
 */
const ALLOWLIST = new Set(["components/dashboard/ProximosCompromissosWidget.tsx"]);

describe("cor de evento vem de cor_efetiva", () => {
  it("nenhum arquivo de agenda pinta a partir da cor crua do evento", () => {
    const arquivos = DIRS.flatMap((d) => walk(join(ROOT, d)));
    const ofensores = arquivos.filter((f) => {
      const rel = f.slice(ROOT.length + 1).replace(/\\/g, "/");
      if (ALLOWLIST.has(rel)) return false;
      const fonte = readFileSync(f, "utf8");
      if (!PADRAO_EVENTO.test(fonte)) return false;
      return pintaCorCrua(fonte);
    });
    expect(ofensores).toEqual([]);
  });

  it("o padrão realmente pega uma pintura crua (senão a guarda é decorativa)", () => {
    expect(pintaCorCrua("style={{ backgroundColor: evento.cor }}")).toBe(true);
    expect(pintaCorCrua("background: e.cor,")).toBe(true);
    // O caminho pontuado era como o calendário pintava de verdade:
    expect(pintaCorCrua("backgroundColor: item.resource.cor || 'x',")).toBe(true);
    // E deixa passar o que é legítimo:
    expect(pintaCorCrua("style={{ backgroundColor: evento.cor_efetiva }}")).toBe(false);
    expect(pintaCorCrua("backgroundColor: item.resource.cor_efetiva || 'x',")).toBe(
      false
    );
    expect(pintaCorCrua("style={{ backgroundColor: cat.cor }}")).toBe(false);
    expect(pintaCorCrua("style={{ backgroundColor: item.cor }}")).toBe(false);
  });
});
