/**
 * Identidade visual — contrato das paletas.
 *
 * Aqui moram as garantias que não podem quebrar sem alguém perceber:
 * contraste do texto sobre o primary, distância das cores semânticas
 * (sucesso/erro/alerta) e a rampa do TS batendo com a do CSS.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  COOKIE_TEMA,
  FONTES,
  PALETAS,
  PALETAS_VALIDAS,
  aplicarTemaNoDocumento,
  fonteValida,
  infoDaPaleta,
  limparTemaDoCookie,
  paletaValida,
  salvarTemaNoCookie,
  sincronizarTema,
} from "./tema";

// ── Ferramentas de cor ──────────────────────────────────────────────────────

const canais = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function luminancia(hex: string): number {
  const [r, g, b] = canais(hex)
    .map((v) => v / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}

/** CIE-Lab, para medir distância perceptual (ΔE) entre duas cores. */
function lab(hex: string): [number, number, number] {
  const [r, g, b] = canais(hex)
    .map((v) => v / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** Verde de sucesso, vermelho de erro e amarelo de alerta usados no sistema. */
const SEMANTICAS: Record<string, string> = {
  "emerald-400": "#34D399",
  "emerald-500": "#10B981",
  "green-400": "#4ADE80",
  "green-500": "#22C55E",
  "red-400": "#F87171",
  "red-500": "#EF4444",
  "amber-400": "#FBBF24",
  "amber-500": "#F59E0B",
  "yellow-500": "#EAB308",
};

/** Tons que aparecem como acento ou superfície na interface. */
const TONS_VISIVEIS = [300, 400, 500, 600, 700];

// ── Acessibilidade ──────────────────────────────────────────────────────────

describe("Paletas — contraste", () => {
  it.each(PALETAS)("$nome: texto branco sobre o primary passa 4.5:1", (p) => {
    expect(contraste("#FFFFFF", p.primary)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(PALETAS)("$nome: o hover também passa 4.5:1", (p) => {
    expect(contraste("#FFFFFF", p.primaryHover)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(PALETAS)(
    "$nome: os tons sólidos da rampa (500/600/700) passam 4.5:1 com branco",
    (p) => {
      for (const tom of [500, 600, 700]) {
        expect(contraste("#FFFFFF", p.rampa[tom])).toBeGreaterThanOrEqual(4.5);
      }
    }
  );

  it.each(PALETAS)(
    "$nome: o acento claro (400) é legível sobre o fundo escuro do sistema",
    (p) => {
      // slate-950, o fundo do app
      expect(contraste(p.rampa[400], "#020617")).toBeGreaterThanOrEqual(4.5);
    }
  );
});

describe("Paletas — cores semânticas continuam distintas", () => {
  it.each(PALETAS)(
    "$nome: nenhum tom visível se confunde com sucesso/erro/alerta",
    (p) => {
      for (const tom of TONS_VISIVEIS) {
        for (const [nome, cor] of Object.entries(SEMANTICAS)) {
          const distancia = deltaE(p.rampa[tom], cor);
          // ΔE 15 já é diferença óbvia a olho nu (ΔE 1 é o limite do perceptível).
          expect(
            distancia,
            `${p.id}-${tom} (${p.rampa[tom]}) x ${nome} (${cor})`
          ).toBeGreaterThan(15);
        }
      }
    }
  );

  it("a paleta Floresta não se confunde com o verde de sucesso", () => {
    const floresta = infoDaPaleta("floresta");
    expect(deltaE(floresta.primary, "#10B981")).toBeGreaterThan(15);
    expect(deltaE(floresta.rampa[400], "#34D399")).toBeGreaterThan(15);
  });

  it("a paleta Âmbar não se confunde com o amarelo de alerta", () => {
    const ambar = infoDaPaleta("ambar");
    expect(deltaE(ambar.primary, "#F59E0B")).toBeGreaterThan(15);
    expect(deltaE(ambar.rampa[400], "#FBBF24")).toBeGreaterThan(15);
  });
});

// ── TS x CSS ────────────────────────────────────────────────────────────────

describe("Paletas — o CSS e o TS contam a mesma história", () => {
  const css = readFileSync(resolve(__dirname, "../app/globals.css"), "utf8");

  it.each(PALETAS)("$nome: a rampa do CSS é igual à do TS", (p) => {
    const seletor =
      p.id === "synapse"
        ? ':root, [data-tema="synapse"] {'
        : `[data-tema="${p.id}"] {`;
    const inicio = css.indexOf(seletor);
    expect(inicio, `bloco de ${p.id} não encontrado no globals.css`).toBeGreaterThan(-1);
    const bloco = css.slice(inicio, css.indexOf("}", inicio));

    for (const [tom, hex] of Object.entries(p.rampa)) {
      const canaisEsperados = canais(hex).join(" ");
      expect(bloco, `--brand-${tom} de ${p.id}`).toContain(
        `--brand-${tom}: ${canaisEsperados};`
      );
    }
    expect(bloco).toContain(`--brand-primary: ${p.primary};`);
    expect(bloco).toContain(`--brand-primary-hover: ${p.primaryHover};`);
    expect(bloco).toContain(`--brand-primary-subtle: ${p.primarySubtle};`);
    expect(bloco).toContain(`--brand-ring: ${p.ring};`);
  });

  it("as cores semânticas não aparecem nos blocos de paleta", () => {
    // Sucesso/erro/alerta não podem virar variável de tema.
    const blocos = css.slice(css.indexOf(':root, [data-tema="synapse"] {'));
    expect(blocos).not.toContain("--success");
    expect(blocos).not.toContain("--danger");
    expect(blocos).not.toContain("--warning");
  });
});

// ── Helpers ─────────────────────────────────────────────────────────────────

describe("Validação e aplicação", () => {
  beforeEach(() => {
    delete document.documentElement.dataset.tema;
    delete document.documentElement.dataset.fonte;
    limparTemaDoCookie();
  });

  afterEach(() => limparTemaDoCookie());

  it("são cinco paletas e três fontes", () => {
    expect(PALETAS).toHaveLength(5);
    expect(PALETAS.map((p) => p.id)).toEqual([...PALETAS_VALIDAS]);
    expect(FONTES).toHaveLength(3);
  });

  it("valor inválido cai no padrão", () => {
    expect(paletaValida("rosa-choque")).toBe("synapse");
    expect(paletaValida(undefined)).toBe("synapse");
    expect(paletaValida("oceano")).toBe("oceano");
    expect(fonteValida("comic-sans")).toBe("padrao");
    expect(fonteValida("serifada")).toBe("serifada");
  });

  it("aplicar escreve os data-attributes no <html>", () => {
    aplicarTemaNoDocumento("floresta", "geometrica");
    expect(document.documentElement.dataset.tema).toBe("floresta");
    expect(document.documentElement.dataset.fonte).toBe("geometrica");
  });

  it("sincronizar aplica no documento e guarda no cookie", () => {
    sincronizarTema({ tema_paleta: "ambar", tema_fonte: "serifada" });
    expect(document.documentElement.dataset.tema).toBe("ambar");
    expect(document.documentElement.dataset.fonte).toBe("serifada");
    expect(document.cookie).toContain(`${COOKIE_TEMA}=ambar.serifada`);
  });

  it("empresa sem tema definido fica no padrão", () => {
    sincronizarTema(null);
    expect(document.documentElement.dataset.tema).toBe("synapse");
    expect(document.documentElement.dataset.fonte).toBe("padrao");
  });

  it("limpar o cookie não deixa a escolha para o próximo login", () => {
    salvarTemaNoCookie("oceano", "padrao");
    expect(document.cookie).toContain(COOKIE_TEMA);
    limparTemaDoCookie();
    expect(document.cookie).not.toContain("oceano");
  });
});
