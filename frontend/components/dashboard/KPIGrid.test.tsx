/**
 * Os KPIs do dashboard: zero de verdade e falha não podem se parecer.
 *
 * Esta é a prova de que o ERR-04 não volta. O bug não era um número errado
 * qualquer — era a falha de uma consulta vestida de resposta: "R$ 0,00" num
 * cartão que nunca soube quanto a empresa faturou. Os dois casos aparecem
 * sempre juntos nos testes abaixo, porque é o par que define a distinção.
 * Um teste só de falha passaria com o cartão exibindo aviso para tudo.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { KPIGrid } from "./KPIGrid";
import type { DashboardResumo } from "@/types/dashboard";

/** Nenhum usuário no store = todos os módulos ativos, os 8 KPIs na tela. */
function resumo(over: Partial<DashboardResumo> = {}): DashboardResumo {
  return {
    financeiro: {
      total_receitas: 12500.5,
      total_despesas: 4300,
      saldo_mes: 8200.5,
      total_pendente: 1800,
      total_atrasado: 0,
      lancamentos_count: 7,
    },
    estoque: {
      total_produtos: 42,
      valor_total_estoque: 9000,
      produtos_sem_estoque: 0,
      produtos_abaixo_minimo: 0,
      giro_medio: 0,
    },
    crm: {
      total_clientes: 15,
      clientes_ativos: 12,
      novos_este_mes: 3,
      valor_total_gerado: 50000,
      ticket_medio_geral: 3333.33,
      followups_atrasados: 0,
      clientes_por_status: {},
    },
    projetos: {
      total_projetos: 5,
      projetos_ativos: 3,
      projetos_atrasados: 0,
      tarefas_pendentes: 9,
      tarefas_minhas: 4,
      tarefas_atrasadas: 0,
      projetos_por_status: {},
    },
    equipe: { total_membros: 3, membros_ativos: 3, por_perfil: {}, por_departamento: [] },
    notificacoes: { nao_lidas: 0 },
    meta: { mes: 10, ano: 2026, gerado_em: "2026-10-04" },
    ...over,
  };
}

/** O bloco financeiro de uma empresa que de fato não movimentou nada. */
const FINANCEIRO_ZERADO = {
  total_receitas: 0,
  total_despesas: 0,
  saldo_mes: 0,
  total_pendente: 0,
  total_atrasado: 0,
  lancamentos_count: 0,
};

describe("Bloco que respondeu", () => {
  it("mostra os números", () => {
    render(<KPIGrid resumo={resumo()} isLoading={false} />);

    expect(screen.getByText("R$ 12.500,50")).toBeInTheDocument();
    expect(screen.getByText("7 lançamentos")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.queryByText("Não foi possível carregar")).not.toBeInTheDocument();
  });

  it("zero legítimo sai como R$ 0,00, e não como aviso", () => {
    render(
      <KPIGrid resumo={resumo({ financeiro: FINANCEIRO_ZERADO })} isLoading={false} />
    );

    // Três cartões financeiros zerados: receitas, despesas e a receber.
    expect(screen.getAllByText("R$ 0,00").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("0 lançamentos")).toBeInTheDocument();
    // "não vendeu nada neste mês" é um fato, e o dono do negócio age nele.
    expect(screen.queryByText("Não foi possível carregar")).not.toBeInTheDocument();
  });
});

describe("Bloco que não respondeu", () => {
  it("avisa em vez de mostrar zero", () => {
    render(<KPIGrid resumo={resumo({ financeiro: null })} isLoading={false} />);

    // Os três cartões do financeiro avisam.
    expect(screen.getAllByText("Não foi possível carregar")).toHaveLength(3);
    expect(screen.getAllByText("—")).toHaveLength(3);
    // E nenhum deles inventa um valor.
    expect(screen.queryByText("R$ 0,00")).not.toBeInTheDocument();
    expect(screen.queryByText("0 lançamentos")).not.toBeInTheDocument();
  });

  it("o cartão continua na tela, com seu título", () => {
    render(<KPIGrid resumo={resumo({ financeiro: null })} isLoading={false} />);

    // Sumir com o cartão seria outra forma de esconder: quem conhece a tela
    // procuraria o número e não acharia explicação nenhuma.
    expect(screen.getByText("Receitas do Mês")).toBeInTheDocument();
    expect(screen.getByText("Despesas do Mês")).toBeInTheDocument();
    expect(screen.getByText("A Receber")).toBeInTheDocument();
  });

  it("a falha de um bloco não apaga os outros", () => {
    render(<KPIGrid resumo={resumo({ financeiro: null })} isLoading={false} />);

    expect(screen.getByText("15")).toBeInTheDocument(); // clientes, do CRM
    expect(screen.getByText("42")).toBeInTheDocument(); // produtos, do estoque
    expect(screen.getByText("3")).toBeInTheDocument(); // projetos ativos
  });

  it("cada bloco degrada por conta própria", () => {
    render(
      <KPIGrid
        resumo={resumo({ estoque: null, projetos: null })}
        isLoading={false}
      />
    );

    // 1 de estoque + 2 de projetos = 3 avisos; o financeiro e o CRM intactos.
    expect(screen.getAllByText("Não foi possível carregar")).toHaveLength(3);
    expect(screen.getByText("R$ 12.500,50")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
  });
});

describe("O par que define a distinção", () => {
  /**
   * O `Intl.NumberFormat` separa "R$" do número com espaço indivisível
   * (U+00A0). O `getByText` normaliza isso sozinho; ler o `textContent` cru,
   * não — e a busca por "R$ 0,00" com espaço comum falha sem explicar por quê.
   */
  const texto = () => (document.body.textContent ?? "").replace(/\u00a0/g, " ");

  it("zero e falha produzem telas DIFERENTES", () => {
    const { unmount } = render(
      <KPIGrid resumo={resumo({ financeiro: FINANCEIRO_ZERADO })} isLoading={false} />
    );
    const comZero = texto();
    unmount();

    render(<KPIGrid resumo={resumo({ financeiro: null })} isLoading={false} />);
    const comFalha = texto();

    expect(comZero).not.toBe(comFalha);
    expect(comZero).toContain("R$ 0,00");
    expect(comZero).not.toContain("Não foi possível carregar");
    expect(comFalha).toContain("Não foi possível carregar");
    expect(comFalha).not.toContain("R$ 0,00");
  });
});
