/**
 * Contraste das 10 combinações: 5 paletas × 2 modos.
 *
 * O teste lê o globals.css de verdade e resolve a cascata do jeito que o
 * navegador resolveria — assim ninguém consegue mexer numa cor e passar no
 * verde sem que o par crítico seja reavaliado.
 *
 * A régua é a WCAG AA: 4.5:1 para texto. Bordas não são texto; o que se cobra
 * delas é serem perceptíveis o bastante para delimitar a caixa.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { PALETAS_VALIDAS } from "@/lib/tema";

const CSS = readFileSync(resolve(__dirname, "./globals.css"), "utf8");

type Modo = "claro" | "escuro";
type RGB = [number, number, number];

/* ── Leitura do CSS ────────────────────────────────────────── */

interface Bloco {
  seletores: string[];
  decls: Record<string, string>;
}

function lerBlocos(css: string): Bloco[] {
  // Tira os comentários para não confundir o parser.
  const limpo = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const blocos: Bloco[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(limpo))) {
    const seletores = m[1].trim().split(",").map((s) => s.trim());
    if (!seletores.length || seletores[0].startsWith("@")) continue;
    const decls: Record<string, string> = {};
    for (const par of m[2].split(";")) {
      const i = par.indexOf(":");
      if (i < 0) continue;
      const nome = par.slice(0, i).trim();
      if (nome.startsWith("--")) decls[nome] = par.slice(i + 1).trim();
    }
    if (Object.keys(decls).length) blocos.push({ seletores, decls });
  }
  return blocos;
}

const BLOCOS = lerBlocos(CSS);

/** O seletor vale para esta combinação de paleta e modo? */
function casa(seletor: string, paleta: string, modo: Modo): boolean {
  if (seletor.includes(":not(")) return false; // rede de segurança duplicada
  const tema = seletor.match(/\[data-tema="([^"]+)"\]/);
  const md = seletor.match(/\[data-modo="([^"]+)"\]/);
  if (tema && tema[1] !== paleta) return false;
  if (md && md[1] !== modo) return false;
  // Sobrou :root ou um seletor sem relação com tema (ex.: [data-fonte=...]).
  const semAtributos = seletor.replace(/\[[^\]]+\]/g, "").trim();
  if (semAtributos && semAtributos !== ":root" && semAtributos !== "html") {
    return false;
  }
  return true;
}

/** Todas as variáveis que valem para (paleta, modo), na ordem da cascata. */
function resolverTokens(paleta: string, modo: Modo): Record<string, string> {
  const fora: Record<string, string> = {};
  for (const bloco of BLOCOS) {
    if (!bloco.seletores.some((s) => casa(s, paleta, modo))) continue;
    Object.assign(fora, bloco.decls);
  }
  // Uma volta de indireção: --brand-accent: var(--brand-400).
  for (const [k, v] of Object.entries(fora)) {
    const ref = v.match(/^var\((--[\w-]+)\)$/);
    if (ref && fora[ref[1]]) fora[k] = fora[ref[1]];
  }
  return fora;
}

/* ── Cor e contraste ───────────────────────────────────────── */

function hslParaRgb(h: number, s: number, l: number): RGB {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** Aceita "240 33% 6%" (canais HSL) e "#RRGGBB". */
function paraRgb(valor: string): RGB {
  const hex = valor.trim().match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const canais = valor.trim().match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (canais) {
    return hslParaRgb(+canais[1], +canais[2], +canais[3]);
  }
  const rgb = valor.trim().match(/^([\d.]+)\s+([\d.]+)\s+([\d.]+)$/);
  if (rgb) return [+rgb[1], +rgb[2], +rgb[3]];
  throw new Error(`cor não reconhecida: "${valor}"`);
}

function luminancia([r, g, b]: RGB): number {
  const f = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contraste(a: RGB, b: RGB): number {
  const [la, lb] = [luminancia(a), luminancia(b)];
  const [claro, escuro] = la > lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (escuro + 0.05);
}

/** ΔE (CIE76) — o quanto duas cores são distinguíveis a olho. */
function deltaE(c1: RGB, c2: RGB): number {
  const lab = ([r, g, b]: RGB) => {
    const f = (c: number) => {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const [R, G, B] = [f(r), f(g), f(b)];
    const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
    const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
    const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const g2 = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    return [116 * g2(y) - 16, 500 * (g2(x) - g2(y)), 200 * (g2(y) - g2(z))];
  };
  const [l1, a1, b1] = lab(c1);
  const [l2, a2, b2] = lab(c2);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/* ── Os casos ──────────────────────────────────────────────── */

const MODOS: Modo[] = ["claro", "escuro"];
const COMBINACOES = PALETAS_VALIDAS.flatMap((paleta) =>
  MODOS.map((modo) => ({ paleta, modo }))
);

/** Pares texto/fundo que precisam passar em 4.5:1. */
const PARES_DE_TEXTO: Array<[string, string, string]> = [
  ["texto sobre o fundo da página", "--foreground", "--background"],
  ["texto sobre o card", "--foreground", "--card"],
  ["texto suave sobre o card", "--foreground-suave", "--card"],
  ["texto secundário sobre o fundo", "--muted-foreground", "--background"],
  ["texto secundário sobre o card", "--muted-foreground", "--card"],
  ["texto terciário sobre o card", "--muted-suave", "--card"],
  ["legenda do botão sobre o primary", "--primary-foreground", "--primary"],
  ["destaque da marca sobre o card", "--brand-accent", "--card"],
  ["sucesso sobre o card", "--sucesso", "--card"],
  ["erro sobre o card", "--erro", "--card"],
  ["alerta sobre o card", "--alerta", "--card"],
  ["info sobre o card", "--info", "--card"],
  ["eixo do gráfico sobre o card", "--grafico-eixo", "--card"],
];

describe.each(COMBINACOES)("$paleta · modo $modo", ({ paleta, modo }) => {
  const tokens = resolverTokens(paleta, modo);
  const cor = (nome: string) => {
    const v = tokens[nome];
    if (!v) throw new Error(`token ausente em ${paleta}/${modo}: ${nome}`);
    return paraRgb(v);
  };

  it.each(PARES_DE_TEXTO)("%s ≥ 4.5:1", (_nome, frente, fundo) => {
    expect(contraste(cor(frente), cor(fundo))).toBeGreaterThanOrEqual(4.5);
  });

  it("a borda delimita o card", () => {
    // Borda não é texto: o que se cobra é ser percebida. A régua muda por
    // modo porque o trabalho dela muda: no claro é ela (mais a sombra) que
    // separa o card do fundo; no escuro é um fio de apoio, porque a
    // separação principal vem do card ser mais claro que a página.
    const r = contraste(cor("--border"), cor("--card"));
    expect(r).toBeGreaterThanOrEqual(modo === "claro" ? 1.4 : 1.2);
  });

  it("as cores semânticas não se confundem com a da marca", () => {
    // Se o verde de sucesso e o roxo da marca ficarem parecidos, o usuário
    // perde a leitura rápida de "deu certo" x "é um botão".
    const marca = cor("--primary");
    for (const nome of ["--sucesso", "--erro", "--alerta", "--info"] as const) {
      expect(deltaE(cor(nome), marca)).toBeGreaterThan(15);
    }
  });

  it("o modo claro é mesmo claro (e o escuro, escuro)", () => {
    const l = luminancia(cor("--background"));
    if (modo === "claro") expect(l).toBeGreaterThan(0.6);
    else expect(l).toBeLessThan(0.1);
  });
});

/**
 * Relatório legível — é o que vai no resumo do PR. Roda como teste para não
 * apodrecer: se um token sumir, ele quebra junto.
 */
it("tabela de contraste das 10 combinações", () => {
  const linhas: string[] = [];
  for (const { paleta, modo } of COMBINACOES) {
    const tokens = resolverTokens(paleta, modo);
    const c = (n: string) => paraRgb(tokens[n]);
    const r = (a: string, b: string) => contraste(c(a), c(b)).toFixed(2);
    linhas.push(
      [
        paleta.padEnd(9),
        modo.padEnd(7),
        `texto/fundo ${r("--foreground", "--background")}`.padEnd(20),
        `sec/fundo ${r("--muted-foreground", "--background")}`.padEnd(18),
        `botão ${r("--primary-foreground", "--primary")}`.padEnd(13),
        `marca/card ${r("--brand-accent", "--card")}`,
      ].join(" | ")
    );
  }
  console.log("\n" + linhas.join("\n"));
  expect(linhas).toHaveLength(10);
});
