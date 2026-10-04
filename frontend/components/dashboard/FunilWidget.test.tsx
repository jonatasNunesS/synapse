/**
 * O funil de vendas: o widget onde a falha era mais fotogênica.
 *
 * Seis etapas em zero não parecem erro — parecem uma empresa que ainda não
 * vendeu nada. É o retrato errado mais convincente do dashboard inteiro.
 *
 * E tem um segundo defeito, achado ao escrever estes testes: `FunilEtapa`
 * declarava `valor_total` e `percentual`, e o backend nunca mandou nenhum dos
 * dois. O tooltip chamava `percentual.toFixed(1)` em `undefined`, então
 * passar o mouse numa barra estourava. Campo declarado que não chega é pior
 * que campo ausente, porque o tipo garante a quem lê que ele existe.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { FunilWidget, CustomTooltipFunil, plotarEtapas } from "./FunilWidget";
import type { FunilEtapa } from "@/types/dashboard";

const ETAPAS: FunilEtapa[] = [
  { status: "lead", label: "Lead", count: 6 },
  { status: "proposta", label: "Proposta", count: 3 },
  { status: "fechado", label: "Fechado", count: 1 },
];

describe("Estados do funil", () => {
  it("com clientes, mostra o total no cabeçalho", () => {
    render(<FunilWidget etapas={ETAPAS} isLoading={false} />);
    expect(screen.getByText("10 clientes")).toBeInTheDocument();
  });

  it("empresa sem cliente nenhum: as etapas existem, zeradas", () => {
    const zeradas = ETAPAS.map((e) => ({ ...e, count: 0 }));
    render(<FunilWidget etapas={zeradas} isLoading={false} />);

    // "ainda não cadastrei ninguém" é um fato, e é o que o CRM novo mostra.
    expect(screen.getByText("Nenhum cliente cadastrado ainda.")).toBeInTheDocument();
    expect(screen.queryByText(/Não foi possível carregar/)).not.toBeInTheDocument();
  });

  it("consulta falhou: aviso, e não um funil vazio", () => {
    render(<FunilWidget etapas={[]} isLoading={false} indisponivel />);

    expect(screen.getByText(/Não foi possível carregar o funil de vendas/)).toBeInTheDocument();
    expect(screen.queryByText("Nenhum cliente cadastrado ainda.")).not.toBeInTheDocument();
  });

  it("zero legítimo e falha dão telas diferentes", () => {
    const { unmount } = render(
      <FunilWidget etapas={ETAPAS.map((e) => ({ ...e, count: 0 }))} isLoading={false} />
    );
    const comZero = document.body.textContent ?? "";
    unmount();

    render(<FunilWidget etapas={[]} isLoading={false} indisponivel />);
    expect(document.body.textContent).not.toBe(comZero);
  });
});

describe("O percentual sai do widget, não do payload", () => {
  it("plotarEtapas calcula a fatia de cada etapa", () => {
    const plotadas = plotarEtapas(ETAPAS);

    expect(plotadas.map((p) => p.percentual)).toEqual([60, 30, 10]);
    expect(plotadas.every((p) => Number.isFinite(p.percentual))).toBe(true);
  });

  it("total zero não gera NaN", () => {
    const plotadas = plotarEtapas(ETAPAS.map((e) => ({ ...e, count: 0 })));
    expect(plotadas.map((p) => p.percentual)).toEqual([0, 0, 0]);
  });
});

describe("Tooltip", () => {
  /**
   * Alimentado com EXATAMENTE o que `plotarEtapas` produz, e não com um
   * objeto montado à mão. É esse acoplamento que guarda o defeito: se alguém
   * tirar o `percentual` do `plotarEtapas`, o tooltip quebra aqui — e não só
   * em produção, ao passar o mouse na barra.
   *
   * Montado à mão porque o jsdom não desenha o gráfico (o
   * ResponsiveContainer fica com largura 0) e o mouse nunca chega à barra.
   */
  function abrirNaEtapa(indice: number, etapas = ETAPAS) {
    return render(
      <CustomTooltipFunil active payload={[{ payload: plotarEtapas(etapas)[indice] }]} />
    );
  }

  it("mostra a contagem e o percentual sem estourar", () => {
    abrirNaEtapa(0);
    expect(screen.getByText("6 clientes")).toBeInTheDocument();
    expect(screen.getByText("60.0% do total")).toBeInTheDocument();
  });

  it("singular quando é um só cliente", () => {
    abrirNaEtapa(2);
    expect(screen.getByText("1 cliente")).toBeInTheDocument();
    expect(screen.getByText("10.0% do total")).toBeInTheDocument();
  });

  it("uma etapa sozinha é 100% do total", () => {
    abrirNaEtapa(0, [{ status: "lead", label: "Lead", count: 4 }]);
    expect(screen.getByText("100.0% do total")).toBeInTheDocument();
  });

  it("nunca escreve NaN nem undefined", () => {
    abrirNaEtapa(0);
    expect(document.body.textContent).not.toMatch(/NaN|undefined/);
  });

  it("não renderiza nada quando inativo", () => {
    const { container } = render(<CustomTooltipFunil active={false} payload={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
