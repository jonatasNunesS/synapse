/**
 * Visão geral do Kanban da equipe: o filtro por membro (chips) esconde as
 * tarefas dos demais membros.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { KanbanEquipeGeral } from "./KanbanEquipeGeral";
import type { KanbanConsolidado } from "@/types/equipe";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ usuario: { id: "admin1", perfil: "admin" } }),
}));

const kanban: KanbanConsolidado = {
  colunas: [
    {
      id: "c1", nome: "A Fazer", ordem: 1, cor: "",
      tarefas: [
        {
          id: "t1", origem: "pessoal", titulo: "Tarefa da Ana", descricao: "",
          prioridade: "media", prazo: null, esta_atrasada: false, coluna_id: "c1",
          ordem: 0, responsavel: { id: "ana", nome: "Ana", avatar_url: "" },
          read_only: false, projeto_id: null, projeto_nome: null,
        },
        {
          id: "t2", origem: "pessoal", titulo: "Tarefa do Beto", descricao: "",
          prioridade: "alta", prazo: null, esta_atrasada: false, coluna_id: "c1",
          ordem: 1, responsavel: { id: "beto", nome: "Beto", avatar_url: "" },
          read_only: false, projeto_id: null, projeto_nome: null,
        },
      ],
    },
  ],
};

vi.mock("@/hooks/useEquipe", () => ({
  useKanbanEquipe: () => ({ kanban, isLoading: false, mutate: vi.fn() }),
  useMembros: () => ({
    membros: [
      { usuario_id: "ana", nome: "Ana" },
      { usuario_id: "beto", nome: "Beto" },
    ],
  }),
  editarTarefaPessoal: vi.fn(),
  apagarTarefaPessoal: vi.fn(),
  moverTarefaPessoal: vi.fn(),
}));

describe("KanbanEquipeGeral — filtro por membro", () => {
  it("mostra todas as tarefas por padrão", () => {
    render(<KanbanEquipeGeral />);
    expect(screen.getByText("Tarefa da Ana")).toBeInTheDocument();
    expect(screen.getByText("Tarefa do Beto")).toBeInTheDocument();
  });

  it("clicar no chip de um membro filtra as tarefas", () => {
    render(<KanbanEquipeGeral />);
    // Chip do membro Ana (botão com o nome)
    fireEvent.click(screen.getByRole("button", { name: "Ana" }));
    expect(screen.getByText("Tarefa da Ana")).toBeInTheDocument();
    expect(screen.queryByText("Tarefa do Beto")).not.toBeInTheDocument();
  });
});
