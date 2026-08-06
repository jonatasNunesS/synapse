/**
 * Landing — helper de estilo inline.
 *
 * A landing veio de um HTML calibrado à mão (clamp(), hex e rgba exatos). Para
 * não correr o risco de "arredondar" nenhum valor na transcrição, cada bloco
 * mantém a MESMA string CSS do original e este helper a converte no objeto de
 * style que o React espera.
 *
 * A única troca feita no caminho é a família de fonte: os nomes literais
 * viram as variáveis do next/font (carregadas no layout público).
 */
import type { CSSProperties } from "react";

/** Nome da fonte no HTML original → variável gerada pelo next/font. */
const FONTES: Record<string, string> = {
  "'Instrument Serif'": "var(--font-instrument-serif)",
  '"Instrument Serif"': "var(--font-instrument-serif)",
  "'IBM Plex Sans'": "var(--font-plex-sans)",
  '"IBM Plex Sans"': "var(--font-plex-sans)",
  "'IBM Plex Mono'": "var(--font-plex-mono)",
  '"IBM Plex Mono"': "var(--font-plex-mono)",
};

const cache = new Map<string, CSSProperties>();

function camel(prop: string): string {
  return prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** Divide em declarações respeitando parênteses (rgba(...), clamp(...)). */
function declaracoes(css: string): string[] {
  const out: string[] = [];
  let atual = "";
  let profundidade = 0;
  for (const ch of css) {
    if (ch === "(") profundidade++;
    else if (ch === ")") profundidade--;
    if (ch === ";" && profundidade === 0) {
      out.push(atual);
      atual = "";
      continue;
    }
    atual += ch;
  }
  out.push(atual);
  return out;
}

function trocarFontes(valor: string): string {
  let saida = valor;
  for (const [nome, variavel] of Object.entries(FONTES)) {
    saida = saida.split(nome).join(variavel);
  }
  return saida;
}

/** Converte a string CSS do HTML original em style do React. */
export function s(css: string): CSSProperties {
  const cacheado = cache.get(css);
  if (cacheado) return cacheado;

  const estilo: Record<string, string> = {};
  for (const decl of declaracoes(css)) {
    const corte = decl.indexOf(":");
    if (corte < 0) continue;
    const prop = decl.slice(0, corte).trim();
    let valor = decl.slice(corte + 1).trim();
    if (!prop || !valor) continue;
    if (prop === "font-family") valor = trocarFontes(valor);
    estilo[prop.startsWith("--") ? prop : camel(prop)] = valor;
  }

  const resultado = estilo as CSSProperties;
  cache.set(css, resultado);
  return resultado;
}
