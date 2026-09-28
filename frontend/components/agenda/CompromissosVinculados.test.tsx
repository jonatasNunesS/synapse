/**
 * A seção de compromissos que aparece no projeto e na venda.
 *
 * O ponto é simples e é o que fecha a Fase B: o vínculo deixa de ser de mão
 * única. Do projeto agora dá para ver os eventos dele.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { CompromissosVinculados, separarPorTempo } from "./CompromissosVinculados";
import type { Evento } from "@/types/agenda";

const AGORA = new Date("2026-10-05T12:00:00.000Z").getTime();

function evento(over: Partial<Evento> = {}): Evento {
  return {
    id: "e1", titulo: "Reunião de entrega", descricao: "",
    data_inicio: "2026-10-05T14:00:00.000Z",
    data_fim: "2026-10-05T15:00:00.000Z",
    dia_inteiro: false, local: "", cor: "#6D28D9", cor_efetiva: "#6D28D9",
    categoria: null, categoria_nome: null,
    projeto: null, projeto_nome: null, venda: null, venda_rotulo: null,
    lembrete_antecedencia: 0,
    cliente: null, cliente_nome: null, criado_por: null, criado_por_nome: null,
    criado_em: "", atualizado_em: "",
    ...over,
  };
}

function montar(eventos: Evento[], over: { loading?: boolean; sufixo?: string } = {}) {
  render(
    <CompromissosVinculados
      eventos={eventos}
      loading={over.loading ?? false}
      agora={AGORA}
      vazioSufixo={over.sufixo ?? "neste projeto"}
    />
  );
}

describe("Mostra os compromissos do vínculo", () => {
  it("lista o evento com título e horário", () => {
    montar([evento()]);

    expect(screen.getByText("Reunião de entrega")).toBeInTheDocument();
    expect(screen.getByText(/05\/10/)).toBeInTheDocument();
  });

  it("pinta pela cor_efetiva, que é a da categoria quando há uma", () => {
    montar([evento({ cor: "#6D28D9", cor_efetiva: "#f97316", categoria: "c1" })]);

    const barra = screen.getByText("Reunião de entrega").closest("a")
      ?.querySelector("span[aria-hidden]");
    expect(barra).toHaveStyle({ backgroundColor: "#f97316" });
  });

  it("mostra o nome da categoria, para a cor ter significado aqui também", () => {
    montar([evento({ categoria: "c1", categoria_nome: "Entrega" })]);

    expect(screen.getByText("Entrega")).toBeInTheDocument();
  });

  it("evento de dia inteiro não mostra hora inventada", () => {
    montar([evento({ dia_inteiro: true })]);

    expect(screen.getByText(/dia inteiro/i)).toBeInTheDocument();
  });

  it("carregando não finge que não há nada", () => {
    montar([], { loading: true });

    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
    expect(screen.queryByText(/nenhum compromisso neste/i)).not.toBeInTheDocument();
  });
});

describe("Tela vazia diz de QUE vínculo se trata", () => {
  it("no projeto", () => {
    montar([], { sufixo: "neste projeto" });

    expect(screen.getByText("Nenhum compromisso neste projeto.")).toBeInTheDocument();
  });

  it("na venda", () => {
    montar([], { sufixo: "nesta venda" });

    expect(screen.getByText("Nenhum compromisso nesta venda.")).toBeInTheDocument();
  });
});

describe("O que vem e o que já foi", () => {
  it("separa pelo término, não pelo início", () => {
    // Começou às 11h e vai até as 13h: ao meio-dia ainda está acontecendo, e
    // jogá-lo em "já aconteceram" seria mentir no meio da reunião.
    const acontecendo = evento({
      id: "agora",
      data_inicio: "2026-10-05T11:00:00.000Z",
      data_fim: "2026-10-05T13:00:00.000Z",
    });

    const { proximos, passados } = separarPorTempo([acontecendo], AGORA);

    expect(proximos.map((e) => e.id)).toEqual(["agora"]);
    expect(passados).toEqual([]);
  });

  it("os passados saem do mais recente para o mais antigo", () => {
    const antigo = evento({
      id: "antigo",
      data_inicio: "2026-10-01T10:00:00.000Z",
      data_fim: "2026-10-01T11:00:00.000Z",
    });
    const recente = evento({
      id: "recente",
      data_inicio: "2026-10-04T10:00:00.000Z",
      data_fim: "2026-10-04T11:00:00.000Z",
    });

    const { passados } = separarPorTempo([antigo, recente], AGORA);

    expect(passados.map((e) => e.id)).toEqual(["recente", "antigo"]);
  });

  it("mostra no máximo três passados — o resto é história, está na Agenda", () => {
    const passados = [1, 2, 3, 4, 5].map((n) =>
      evento({
        id: `p${n}`,
        data_inicio: `2026-10-0${n}T10:00:00.000Z`,
        data_fim: `2026-10-0${n}T11:00:00.000Z`,
      })
    );

    expect(separarPorTempo(passados, AGORA).passados).toHaveLength(3);
  });

  it("só passados: avisa que não há nada à frente em vez de calar", () => {
    montar([
      evento({
        data_inicio: "2026-10-01T10:00:00.000Z",
        data_fim: "2026-10-01T11:00:00.000Z",
      }),
    ]);

    expect(screen.getByText(/nenhum compromisso à frente/i)).toBeInTheDocument();
    expect(screen.getByText(/já aconteceram/i)).toBeInTheDocument();
  });

  it("só futuros: não inventa a faixa 'Já aconteceram'", () => {
    montar([evento()]);

    expect(screen.queryByText(/já aconteceram/i)).not.toBeInTheDocument();
  });
});
