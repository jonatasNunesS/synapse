/**
 * Os nove widgets do dashboard, nos três estados que eles têm de distinguir.
 *
 *   com dados       → a lista
 *   lista vazia     → "Nenhum vencimento nos próximos 7 dias"
 *   indisponível    → "Não foi possível carregar"
 *
 * Os dois últimos eram a MESMA coisa antes desta leva: o hook devolvia `[]`
 * tanto para "o banco disse que não há nada" quanto para "o banco não
 * respondeu", e o widget escolhia a frase tranquilizadora. Dizer "nenhum
 * follow-up agendado" quando a consulta falhou é afirmar que o vendedor não
 * tem ninguém para ligar hoje.
 *
 * O teste é uma varredura por tabela de propósito: são nove widgets com a
 * mesma forma, e um deles ficar de fora não apareceria num teste escrito à
 * mão para cada um.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";

import { VencimentosWidget } from "./VencimentosWidget";
import { FollowUpsWidget } from "./FollowUpsWidget";
import { MinhasTarefasWidget } from "./MinhasTarefasWidget";
import { AlertasEstoqueWidget } from "./AlertasEstoqueWidget";
import { ProjetosWidget } from "./ProjetosWidget";
import { AtividadeWidget } from "./AtividadeWidget";
import { ProximosCompromissosWidget } from "./ProximosCompromissosWidget";
import { FluxoCaixaWidget } from "./FluxoCaixaWidget";
import { FunilWidget } from "./FunilWidget";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const hoje = new Date();
const amanha = new Date(hoje.getTime() + 86_400_000);
const emISO = (d: Date) => d.toISOString();
const soData = (d: Date) => d.toISOString().slice(0, 10);

interface Caso {
  nome: string;
  Widget: ComponentType<any>;
  /** A prop da lista e um item que apareça na tela. */
  prop: string;
  item: unknown;
  /** Um trecho visível quando há dados. */
  comDados: string;
  /** O trecho do estado vazio, que NÃO pode aparecer numa falha. */
  vazio: string;
}

const CASOS: Caso[] = [
  {
    nome: "VencimentosWidget",
    Widget: VencimentosWidget,
    prop: "vencimentos",
    item: {
      id: "v1",
      descricao: "Aluguel da loja",
      valor: 1500,
      tipo: "despesa",
      data_vencimento: soData(amanha),
      dias_restantes: 1,
      status: "pendente",
    },
    comDados: "Aluguel da loja",
    vazio: "Nenhum vencimento nos próximos 7 dias.",
  },
  {
    nome: "FollowUpsWidget",
    Widget: FollowUpsWidget,
    prop: "followups",
    item: {
      id: "f1",
      nome: "Marina Alves",
      email: "marina@x.com",
      telefone: "",
      proximo_followup: soData(amanha),
      status_funil: "proposta",
      dias_restantes: 1,
    },
    comDados: "Marina Alves",
    vazio: "Nenhum follow-up agendado para os próximos 3 dias.",
  },
  {
    nome: "MinhasTarefasWidget",
    Widget: MinhasTarefasWidget,
    prop: "tarefas",
    item: {
      id: "t1",
      titulo: "Fechar o orçamento",
      status: "a_fazer",
      prioridade: "alta",
      data_prazo: soData(amanha),
      projeto_id: "p1",
      projeto_nome: "Reforma",
      dias_restantes: 1,
      atrasada: false,
    },
    comDados: "Fechar o orçamento",
    vazio: "Nenhuma tarefa pendente.",
  },
  {
    nome: "AlertasEstoqueWidget",
    Widget: AlertasEstoqueWidget,
    prop: "alertas",
    item: {
      id: "a1",
      nome: "Cimento CP-II",
      sku: "CIM-001",
      estoque_atual: 2,
      estoque_minimo: 10,
      status_estoque: "critico",
      unidade: "sc",
    },
    comDados: "Cimento CP-II",
    vazio: "Estoque saudável! Nenhum alerta.",
  },
  {
    nome: "ProjetosWidget",
    Widget: ProjetosWidget,
    prop: "projetos",
    item: {
      id: "p1",
      nome: "Reforma do galpão",
      status: "em_andamento",
      prioridade: "alta",
      progresso: 40,
      cor: "#6D28D9",
      data_prazo: soData(amanha),
      responsavel_nome: "Jonatas",
      tarefas_total: 5,
      tarefas_concluidas: 2,
      atrasado: false,
    },
    comDados: "Reforma do galpão",
    vazio: "Nenhum projeto em andamento.",
  },
  {
    nome: "AtividadeWidget",
    Widget: AtividadeWidget,
    prop: "eventos",
    item: {
      tipo: "lancamento",
      titulo: "Venda à vista",
      descricao: "R$ 300,00",
      data: emISO(hoje),
      icone: "DollarSign",
      cor: "text-green-600 bg-green-50",
    },
    comDados: "Venda à vista",
    vazio: "Nenhuma atividade recente.",
  },
  {
    nome: "ProximosCompromissosWidget",
    Widget: ProximosCompromissosWidget,
    prop: "compromissos",
    item: {
      id: "c1",
      titulo: "Visita ao cliente",
      data_inicio: emISO(hoje),
      data_fim: emISO(new Date(hoje.getTime() + 3_600_000)),
      dia_inteiro: false,
      local: "",
      cor: "#6D28D9",
      cliente_id: null,
      cliente_nome: null,
      dias_restantes: 0,
    },
    comDados: "Visita ao cliente",
    vazio: "Nenhum compromisso próximo.",
  },
  {
    nome: "FluxoCaixaWidget",
    Widget: FluxoCaixaWidget,
    prop: "fluxo",
    item: {
      data: soData(hoje),
      receitas: 500,
      despesas: 200,
      saldo: 300,
      saldo_acumulado: 300,
    },
    comDados: "Fluxo de Caixa",
    vazio: "Nenhum dado de fluxo de caixa disponível.",
  },
  {
    nome: "FunilWidget",
    Widget: FunilWidget,
    prop: "etapas",
    item: { status: "lead", label: "Lead", count: 4 },
    comDados: "4 clientes",
    vazio: "Nenhum cliente cadastrado ainda.",
  },
];

describe.each(CASOS)("$nome", ({ Widget, prop, item, comDados, vazio }) => {
  it("com dados, mostra os dados", () => {
    render(<Widget {...{ [prop]: [item] }} isLoading={false} />);
    expect(screen.getByText(comDados)).toBeInTheDocument();
    expect(screen.queryByText(vazio)).not.toBeInTheDocument();
    expect(screen.queryByText(/Não foi possível carregar/)).not.toBeInTheDocument();
  });

  it("lista vazia mostra o estado vazio, e não aviso de falha", () => {
    render(<Widget {...{ [prop]: [] }} isLoading={false} />);
    expect(screen.getByText(vazio)).toBeInTheDocument();
    expect(screen.queryByText(/Não foi possível carregar/)).not.toBeInTheDocument();
  });

  it("indisponível mostra aviso, e NÃO o estado vazio", () => {
    render(<Widget {...{ [prop]: [] }} isLoading={false} indisponivel />);
    expect(screen.getByText(/Não foi possível carregar/)).toBeInTheDocument();
    expect(screen.queryByText(vazio)).not.toBeInTheDocument();
  });

  it("indisponível tem precedência sobre o que sobrou na mão", () => {
    // Pode haver dado velho em memória (o SWR guarda a resposta anterior).
    // Mostrá-lo como se fosse atual, depois de a consulta falhar, é a mesma
    // mentira com um passo a mais.
    render(<Widget {...{ [prop]: [item] }} isLoading={false} indisponivel />);
    expect(screen.getByText(/Não foi possível carregar/)).toBeInTheDocument();
  });
});

describe("Tentar de novo", () => {
  it("o botão aparece quando há como tentar, e chama o refresh", async () => {
    const refresh = vi.fn();
    render(
      <VencimentosWidget
        vencimentos={[]}
        isLoading={false}
        indisponivel
        onTentarNovamente={refresh}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("sem handler, não há botão prometendo o que a tela não faz", () => {
    render(<VencimentosWidget vencimentos={[]} isLoading={false} indisponivel />);
    expect(
      screen.queryByRole("button", { name: /Tentar de novo/ })
    ).not.toBeInTheDocument();
  });
});
