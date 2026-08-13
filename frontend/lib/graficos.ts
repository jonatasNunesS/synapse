"use client";
/**
 * Cores dos gráficos (Recharts), resolvidas a partir dos tokens do tema.
 *
 * Por que não passar `hsl(var(--grafico-eixo))` direto na prop: o Recharts
 * repassa essas cores como ATRIBUTO SVG (fill, stroke), e atributo não é CSS —
 * `var()` não resolve ali. Então lemos o valor calculado da raiz e entregamos
 * a cor pronta.
 *
 * Como o modo pode mudar com a tela aberta (o usuário troca a preferência, ou
 * o SO vira à noite para quem está em "sistema"), um MutationObserver observa
 * o data-modo do <html> e recalcula.
 */
import { useEffect, useState } from "react";

export interface CoresDoGrafico {
  grid: string;
  eixo: string;
  tooltipFundo: string;
  tooltipBorda: string;
  texto: string;
  cursor: string;
  /** Semânticas: receita é verde e despesa é vermelha nos dois modos. */
  receita: string;
  despesa: string;
  neutro: string;
}

/** Fallback do modo escuro — vale no servidor, onde não há getComputedStyle. */
const PADRAO: CoresDoGrafico = {
  grid: "hsl(240 20% 18%)",
  eixo: "hsl(240 5% 64.9%)",
  tooltipFundo: "hsl(240 33% 10%)",
  tooltipBorda: "hsl(240 20% 20%)",
  texto: "hsl(0 0% 95%)",
  cursor: "hsl(240 20% 18% / 0.4)",
  receita: "hsl(158 64% 52%)",
  despesa: "hsl(0 91% 71%)",
  neutro: "hsl(213 94% 68%)",
};

function ler(estilo: CSSStyleDeclaration, nome: string): string | null {
  const v = estilo.getPropertyValue(nome).trim();
  return v ? `hsl(${v})` : null;
}

function coresAtuais(): CoresDoGrafico {
  if (typeof window === "undefined") return PADRAO;
  const estilo = getComputedStyle(document.documentElement);
  const grid = ler(estilo, "--grafico-grid");
  return {
    grid: grid ?? PADRAO.grid,
    eixo: ler(estilo, "--grafico-eixo") ?? PADRAO.eixo,
    tooltipFundo: ler(estilo, "--grafico-tooltip-bg") ?? PADRAO.tooltipFundo,
    tooltipBorda: ler(estilo, "--grafico-tooltip-borda") ?? PADRAO.tooltipBorda,
    texto: ler(estilo, "--foreground") ?? PADRAO.texto,
    // O cursor é a faixa que segue o mouse: a mesma cor da grade, mais fraca.
    cursor: grid
      ? `hsl(${estilo.getPropertyValue("--grafico-grid").trim()} / 0.45)`
      : PADRAO.cursor,
    receita: ler(estilo, "--sucesso") ?? PADRAO.receita,
    despesa: ler(estilo, "--erro") ?? PADRAO.despesa,
    neutro: ler(estilo, "--info") ?? PADRAO.neutro,
  };
}

export function useCoresDoGrafico(): CoresDoGrafico {
  const [cores, setCores] = useState<CoresDoGrafico>(PADRAO);

  useEffect(() => {
    setCores(coresAtuais());

    const observador = new MutationObserver(() => setCores(coresAtuais()));
    observador.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-modo", "data-tema"],
    });
    return () => observador.disconnect();
  }, []);

  return cores;
}
