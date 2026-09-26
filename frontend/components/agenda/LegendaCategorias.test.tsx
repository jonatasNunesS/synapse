/**
 * A legenda da agenda.
 *
 * O contrato dela é um só e é o motivo de existir: TODA cor que está na tela
 * tem nome na legenda. Se uma cor aparece no calendário e não aparece aqui,
 * voltamos ao "duas semanas depois ninguém lembra por que é laranja".
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  CHAVE_SEM_CATEGORIA,
  LegendaCategorias,
  montarLegenda,
} from "./LegendaCategorias";
import type { CategoriaEvento, Evento } from "@/types/agenda";

function categoria(over: Partial<CategoriaEvento> = {}): CategoriaEvento {
  return {
    id: "c1",
    nome: "Cobrança",
    cor: "#F97316",
    ativo: true,
    ordem: 0,
    eventos_count: 0,
    criado_em: "",
    ...over,
  };
}

function evento(over: Partial<Evento> = {}): Evento {
  return {
    id: "e1",
    titulo: "Reunião",
    descricao: "",
    data_inicio: "2026-10-05T14:00:00.000Z",
    data_fim: "2026-10-05T15:00:00.000Z",
    dia_inteiro: false,
    local: "",
    cor: "#6D28D9",
    cor_efetiva: "#6D28D9",
    categoria: null,
    categoria_nome: null,
    lembrete_antecedencia: 0,
    cliente: null,
    cliente_nome: null,
    criado_por: null,
    criado_por_nome: null,
    criado_em: "",
    atualizado_em: "",
    ...over,
  };
}

describe("A legenda dá nome à cor", () => {
  it("lista as categorias ativas da empresa, mesmo sem evento no período", () => {
    const itens = montarLegenda([categoria()], []);

    expect(itens).toEqual([{ chave: "c1", nome: "Cobrança", cor: "#F97316" }]);
  });

  it("categoria desativada não polui a legenda quando ninguém a usa na tela", () => {
    const itens = montarLegenda([categoria({ ativo: false })], []);

    expect(itens).toEqual([]);
  });
});

describe("Toda cor da tela tem nome", () => {
  it("categoria desativada que ainda pinta um evento visível aparece na legenda", () => {
    // Este é o caso que a legenda existe para cobrir: a categoria saiu do
    // formulário, mas o evento antigo continua laranja no calendário.
    const itens = montarLegenda(
      [], // a lista ativa não traz a desativada
      [evento({ categoria: "c9", categoria_nome: "Cobrança", cor_efetiva: "#F97316" })]
    );

    expect(itens).toEqual([
      { chave: "c9", nome: "Cobrança", cor: "#F97316", inativa: true },
    ]);
  });

  it("não duplica a categoria que já veio da lista ativa", () => {
    const itens = montarLegenda(
      [categoria()],
      [
        evento({ id: "a", categoria: "c1", categoria_nome: "Cobrança" }),
        evento({ id: "b", categoria: "c1", categoria_nome: "Cobrança" }),
      ]
    );

    expect(itens).toHaveLength(1);
  });

  it("evento sem categoria ganha a entrada 'Sem categoria'", () => {
    const itens = montarLegenda([categoria()], [evento()]);

    expect(itens.at(-1)).toMatchObject({
      chave: CHAVE_SEM_CATEGORIA,
      nome: "Sem categoria",
    });
  });

  it("sem evento solto, não inventa a entrada 'Sem categoria'", () => {
    const itens = montarLegenda(
      [categoria()],
      [evento({ categoria: "c1", categoria_nome: "Cobrança" })]
    );

    expect(itens.map((i) => i.chave)).not.toContain(CHAVE_SEM_CATEGORIA);
  });
});

describe("Renderização", () => {
  it("mostra nome e cor de cada categoria", () => {
    render(
      <LegendaCategorias
        categorias={[categoria(), categoria({ id: "c2", nome: "Visita", cor: "#22C55E" })]}
        eventos={[]}
      />
    );

    expect(screen.getByText("Cobrança")).toBeInTheDocument();
    expect(screen.getByTestId("legenda-cor-c1")).toHaveStyle({
      backgroundColor: "#F97316",
    });
    expect(screen.getByTestId("legenda-cor-c2")).toHaveStyle({
      backgroundColor: "#22C55E",
    });
  });

  it("sem categoria nenhuma e sem evento solto, a legenda não ocupa espaço", () => {
    render(<LegendaCategorias categorias={[]} eventos={[]} />);

    expect(screen.queryByTestId("legenda-categorias")).not.toBeInTheDocument();
  });

  it("marca a desativada para a pessoa entender por que ela não está no formulário", () => {
    render(
      <LegendaCategorias
        categorias={[]}
        eventos={[
          evento({ categoria: "c9", categoria_nome: "Antiga", cor_efetiva: "#F97316" }),
        ]}
      />
    );

    expect(screen.getByText("Antiga")).toBeInTheDocument();
    expect(screen.getByText(/desativada/i)).toBeInTheDocument();
  });
});
