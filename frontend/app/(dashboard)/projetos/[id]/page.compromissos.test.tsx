/**
 * O detalhe do projeto mostra os compromissos vinculados a ele.
 *
 * Fecha a mão dupla do vínculo: do evento já dava para chegar ao projeto; do
 * projeto, até aqui, não dava para ver os eventos.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import ProjetoDetalhePage from "./page";
import type { Evento } from "@/types/agenda";
import type { ProjetoDetail } from "@/types/projetos";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "proj-1" }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

// O kanban e o formulário de tarefa não interessam aqui: viram sondas mudas.
vi.mock("@/components/projetos/KanbanBoard", () => ({
  KanbanBoard: () => <div data-testid="kanban" />,
}));
vi.mock("@/components/projetos/TarefaForm", () => ({ TarefaForm: () => null }));
vi.mock("@/components/projetos/TarefaModal", () => ({ TarefaModal: () => null }));
vi.mock("@/components/projetos/ProjetoForm", () => ({ ProjetoForm: () => null }));

function projeto(): ProjetoDetail {
  return {
    id: "proj-1",
    nome: "Casamento Ana e João",
    status: "em_andamento",
    prioridade: "alta",
    responsavel_nome: null,
    responsavel_avatar: null,
    data_inicio: null,
    data_prazo: null,
    data_conclusao: null,
    progresso: 40,
    total_tarefas: 5,
    tarefas_concluidas: 2,
    esta_atrasado: false,
    dias_restantes: null,
    cor: "#6D28D9",
    criado_em: "2026-09-01T10:00:00.000Z",
    descricao: "",
    criado_por_nome: null,
    atualizado_em: "2026-09-01T10:00:00.000Z",
    tarefas_por_status: { a_fazer: [], em_andamento: [], revisao: [], concluido: [] },
    membros: [],
    total_comentarios: 0,
  };
}

vi.mock("@/hooks/useProjetos", () => ({
  useProjetoDetalhe: () => ({
    projeto: projeto(),
    loading: false,
    recarregar: vi.fn(),
  }),
  useKanban: () => ({
    kanban: null,
    loading: false,
    recarregar: vi.fn(),
    moverTarefa: vi.fn(),
  }),
  useTarefas: () => ({
    tarefas: [],
    loading: false,
    criar: vi.fn(),
    atualizar: vi.fn(),
    deletar: vi.fn(),
  }),
  useTarefaDetalhe: () => ({ tarefa: null, recarregar: vi.fn() }),
}));

/** Eventos que o hook devolve nesta renderização. */
let eventos: Evento[] = [];
const carregar = vi.fn().mockResolvedValue([]);
/** Qual projeto o hook recebeu — prova que o filtro é por ESTE projeto. */
let projetoPedido: string | null = null;
vi.mock("@/hooks/useAgenda", () => ({
  useEventosDoProjeto: (id: string | null) => {
    projetoPedido = id;
    return {
      eventos,
      loading: false,
      error: null,
      carregadoEm: new Date("2026-10-05T12:00:00.000Z").getTime(),
      carregar,
    };
  },
}));

/** Agenda ligada nesta renderização. */
let agendaLigada = true;
vi.mock("@/hooks/useModulos", () => ({
  useModulos: () => ({
    moduloAtivo: (m: string) => (m === "agenda" ? agendaLigada : true),
  }),
}));

function evento(over: Partial<Evento> = {}): Evento {
  return {
    id: "e1", titulo: "Prova do vestido", descricao: "",
    data_inicio: "2026-10-06T14:00:00.000Z",
    data_fim: "2026-10-06T15:00:00.000Z",
    dia_inteiro: false, local: "", cor: "#6D28D9", cor_efetiva: "#6D28D9",
    categoria: null, categoria_nome: null,
    projeto: "proj-1", projeto_nome: "Casamento Ana e João",
    venda: null, venda_rotulo: null,
    lembrete_antecedencia: 0,
    cliente: null, cliente_nome: null, criado_por: null, criado_por_nome: null,
    criado_em: "", atualizado_em: "",
    ...over,
  };
}

beforeEach(() => {
  eventos = [];
  agendaLigada = true;
  projetoPedido = null;
  carregar.mockClear().mockResolvedValue([]);
});

describe("Compromissos do projeto", () => {
  it("mostra os eventos vinculados", async () => {
    eventos = [evento()];
    render(<ProjetoDetalhePage />);

    expect(await screen.findByTestId("compromissos-vinculados")).toBeInTheDocument();
    expect(screen.getByText("Prova do vestido")).toBeInTheDocument();
  });

  it("pede os eventos DESTE projeto", async () => {
    render(<ProjetoDetalhePage />);

    await waitFor(() => expect(carregar).toHaveBeenCalled());
    expect(projetoPedido).toBe("proj-1");
  });

  it("projeto sem compromisso explica em vez de ficar em branco", async () => {
    render(<ProjetoDetalhePage />);

    expect(
      await screen.findByText("Nenhum compromisso neste projeto.")
    ).toBeInTheDocument();
  });

  it("sem o módulo Agenda, a seção não aparece", async () => {
    agendaLigada = false;
    eventos = [evento()];
    render(<ProjetoDetalhePage />);

    // A página do projeto continua inteira.
    expect((await screen.findAllByText("Casamento Ana e João")).length).toBeGreaterThan(0);
    expect(screen.queryByTestId("compromissos-vinculados")).not.toBeInTheDocument();
  });

  it("sem o módulo, nem vai buscar os eventos", async () => {
    agendaLigada = false;
    render(<ProjetoDetalhePage />);

    await screen.findAllByText("Casamento Ana e João");
    expect(carregar).not.toHaveBeenCalled();
  });

  it("falhar ao carregar não derruba a página do projeto", async () => {
    carregar.mockRejectedValueOnce(new Error("rede caiu"));
    render(<ProjetoDetalhePage />);

    expect((await screen.findAllByText("Casamento Ana e João")).length).toBeGreaterThan(0);
    // E a seção segue na tela, apenas vazia — o erro fica no hook, não sobe.
    expect(screen.getByTestId("compromissos-vinculados")).toBeInTheDocument();
  });
});
