/**
 * Módulos configuráveis no Dashboard: os KPIs e widgets de módulos desligados
 * somem. O que é obrigatório (Financeiro, Clientes) fica sempre.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useAppStore } from "@/store/useAppStore";
import type { ModulosEmpresa, Usuario } from "@/types/auth";
import type { DashboardResumo } from "@/types/dashboard";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const resumo: DashboardResumo = {
  financeiro: {
    total_receitas: 1000,
    total_despesas: 400,
    saldo_mes: 600,
    total_pendente: 0,
    total_atrasado: 0,
    lancamentos_count: 3,
  },
  estoque: {
    total_produtos: 12,
    valor_total_estoque: 5000,
    produtos_sem_estoque: 0,
    produtos_abaixo_minimo: 0,
    giro_medio: 0,
  },
  crm: {
    total_clientes: 8,
    clientes_ativos: 6,
    novos_este_mes: 2,
    valor_total_gerado: 9000,
    ticket_medio_geral: 1125,
    followups_atrasados: 0,
    clientes_por_status: {},
  },
  projetos: {
    total_projetos: 3,
    projetos_ativos: 2,
    projetos_atrasados: 0,
    tarefas_pendentes: 4,
    tarefas_minhas: 1,
    tarefas_atrasadas: 0,
    projetos_por_status: {},
  },
  equipe: { total_membros: 2, membros_ativos: 2, por_perfil: {}, por_departamento: [] },
  notificacoes: { nao_lidas: 0 },
  meta: { mes: 8, ano: 2026, gerado_em: "2026-08-05T10:00:00Z" },
};

vi.mock("@/hooks/useDashboard", () => ({
  useDashboardResumo: () => ({ resumo, isLoading: false, refresh: vi.fn() }),
  useDashboardFluxoCaixa: () => ({ fluxo: [], isLoading: false }),
  useDashboardFunil: () => ({ etapas: [], isLoading: false }),
  useDashboardVencimentos: () => ({ vencimentos: [], isLoading: false }),
  useDashboardFollowUps: () => ({ followups: [], isLoading: false }),
  useDashboardMinhasTarefas: () => ({ tarefas: [], isLoading: false }),
  useDashboardAlertasEstoque: () => ({ alertas: [], isLoading: false }),
  useDashboardProjetos: () => ({ projetos: [], isLoading: false }),
  useDashboardAtividade: () => ({ eventos: [], isLoading: false }),
}));

import DashboardPage from "./page";

function setModulos(modulos: Partial<ModulosEmpresa>) {
  useAppStore.setState({
    usuario: {
      id: "u1",
      nome: "Fundador",
      viu_aviso_recorrencias: true,
      modulos,
    } as unknown as Usuario,
  });
}

beforeEach(() => useAppStore.setState({ usuario: null }));

describe("Dashboard × módulos", () => {
  it("com Estoque e Projetos DESLIGADOS os widgets e KPIs somem", () => {
    setModulos({ estoque: false, projetos: false });
    render(<DashboardPage />);

    expect(screen.queryByText("Alertas de Estoque")).not.toBeInTheDocument();
    expect(screen.queryByText("Produtos em Estoque")).not.toBeInTheDocument();
    expect(screen.queryByText("Projetos em Andamento")).not.toBeInTheDocument();
    expect(screen.queryByText("Projetos Ativos")).not.toBeInTheDocument();
    expect(screen.queryByText("Minhas Tarefas")).not.toBeInTheDocument();

    // Obrigatórios continuam
    expect(screen.getByText("Receitas do Mês")).toBeInTheDocument();
    expect(screen.getByText("Total de Clientes")).toBeInTheDocument();
    expect(screen.getByText("Atividade Recente")).toBeInTheDocument();
  });

  it("com os módulos LIGADOS os widgets aparecem", () => {
    setModulos({ estoque: true, projetos: true });
    render(<DashboardPage />);

    expect(screen.getByText("Alertas de Estoque")).toBeInTheDocument();
    expect(screen.getByText("Produtos em Estoque")).toBeInTheDocument();
    expect(screen.getByText("Projetos em Andamento")).toBeInTheDocument();
    expect(screen.getAllByText("Minhas Tarefas").length).toBeGreaterThan(0);
  });
});
