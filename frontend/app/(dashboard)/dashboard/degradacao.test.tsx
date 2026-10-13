/**
 * A fiação: o `indisponivel` do hook tem de chegar ao widget.
 *
 * Os testes de componente provam que cada widget sabe avisar. Este prova que
 * alguém está contando a ele. São nove widgets, e esquecer de passar a prop
 * em um deles deixa aquele cartão com o comportamento antigo — "Nenhum
 * projeto em andamento" para uma consulta que falhou — sem quebrar nada que
 * se perceba.
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

/** Todos os blocos do resumo em falha, para os KPIs avisarem em bloco. */
const RESUMO_DEGRADADO: DashboardResumo = {
  financeiro: null,
  estoque: null,
  crm: null,
  projetos: null,
  equipe: null,
  notificacoes: null,
  meta: { mes: 10, ano: 2026, gerado_em: "2026-10-04" },
};

/**
 * Todo hook devolvendo falha: é o cenário "o banco caiu". Cada hook também
 * devolve a lista vazia, de propósito — é assim que o SWR entrega, e é o que
 * faria o widget cair no estado vazio se a prop não chegasse.
 */
const refresh = vi.fn();

vi.mock("@/hooks/useDashboard", () => ({
  useDashboardResumo: () => ({
    resumo: RESUMO_DEGRADADO,
    isLoading: false,
    isError: false,
    indisponivel: false,
    refresh,
  }),
  useDashboardFluxoCaixa: () => ({
    fluxo: [], dias: 30, isLoading: false, indisponivel: true, refresh,
  }),
  useDashboardFunil: () => ({
    etapas: [], isLoading: false, indisponivel: true, refresh,
  }),
  useDashboardVencimentos: () => ({
    vencimentos: [], dias: 7, isLoading: false, indisponivel: true, refresh,
  }),
  useDashboardFollowUps: () => ({
    followups: [], dias: 3, isLoading: false, indisponivel: true, refresh,
  }),
  useDashboardMinhasTarefas: () => ({
    tarefas: [], isLoading: false, indisponivel: true, refresh,
  }),
  useDashboardAlertasEstoque: () => ({
    alertas: [], isLoading: false, indisponivel: true, refresh,
  }),
  useDashboardProjetos: () => ({
    projetos: [], isLoading: false, indisponivel: true, refresh,
  }),
  useDashboardProximosCompromissos: () => ({
    compromissos: [], dias: 7, isLoading: false, indisponivel: true, refresh,
  }),
  useDashboardAtividade: () => ({
    eventos: [], isLoading: false, indisponivel: true, refresh,
  }),
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

beforeEach(() => {
  useAppStore.setState({ usuario: null });
  refresh.mockClear();
});

describe("Dashboard com tudo degradado", () => {
  it("todos os nove widgets avisam", () => {
    setModulos({ estoque: true, projetos: true, agenda: true });
    render(<DashboardPage />);

    const avisos = screen.getAllByText(/Não foi possível carregar/);
    // 9 widgets de lista/gráfico + os 8 cartões de KPI, que têm texto próprio.
    expect(avisos.length).toBeGreaterThanOrEqual(9 + 8);
  });

  it("nenhum widget diz 'nenhum' quando ninguém consultou", () => {
    setModulos({ estoque: true, projetos: true, agenda: true });
    render(<DashboardPage />);

    const texto = screen.getByText("Dashboard").ownerDocument.body.textContent ?? "";
    for (const frase of [
      "Nenhum vencimento nos próximos 7 dias.",
      "Nenhum follow-up agendado para os próximos 3 dias.",
      "Nenhuma tarefa pendente.",
      "Estoque saudável! Nenhum alerta.",
      "Nenhum projeto em andamento.",
      "Nenhuma atividade recente.",
      "Nenhum compromisso próximo.",
      "Nenhum dado de fluxo de caixa disponível.",
      "Nenhum cliente cadastrado ainda.",
    ]) {
      expect(texto).not.toContain(frase);
    }
  });

  it("a tela continua de pé: cabeçalho e títulos dos cartões", () => {
    setModulos({ estoque: true, projetos: true, agenda: true });
    render(<DashboardPage />);

    // Degradação é por cartão. A página não virou uma tela de erro.
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Visão executiva do seu negócio")).toBeInTheDocument();
    expect(screen.getByText("Atividade Recente")).toBeInTheDocument();
    expect(screen.getByText("Funil de Vendas")).toBeInTheDocument();
    expect(screen.getByText("Receitas do Mês")).toBeInTheDocument();
  });

  it("cada cartão degradado oferece tentar de novo", () => {
    setModulos({ estoque: true, projetos: true, agenda: true });
    render(<DashboardPage />);

    // Um por widget: o `refresh` do próprio hook, não um reload da página.
    expect(
      screen.getAllByRole("button", { name: /Tentar de novo/ }).length
    ).toBeGreaterThanOrEqual(9);
  });

  it("widget de módulo desligado não aparece, nem com aviso", () => {
    setModulos({ estoque: false, projetos: false, agenda: false });
    render(<DashboardPage />);

    // Módulo desligado é decisão da empresa: nada a carregar, nada a avisar.
    expect(screen.queryByText("Alertas de Estoque")).not.toBeInTheDocument();
    expect(screen.queryByText("Projetos em Andamento")).not.toBeInTheDocument();
    expect(screen.queryByText("Produtos em Estoque")).not.toBeInTheDocument();
  });
});
