/**
 * Board do Kanban da equipe: renderiza colunas e tarefas, mostra o badge
 * "Projeto X" nas tarefas de projeto e dispara onAbrirTarefa ao clicar.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EquipeKanbanBoard } from "./EquipeKanbanBoard";
import type { ColunaKanbanComTarefas, TarefaKanban } from "@/types/equipe";

function tarefa(over: Partial<TarefaKanban>): TarefaKanban {
  return {
    id: "t1", origem: "pessoal", titulo: "Tarefa A", descricao: "",
    prioridade: "media", prazo: null, esta_atrasada: false, coluna_id: "c1",
    ordem: 0, responsavel: { id: "u1", nome: "João Silva", avatar_url: "" },
    read_only: false, projeto_id: null, projeto_nome: null, ...over,
  };
}

function colunas(): ColunaKanbanComTarefas[] {
  return [
    {
      id: "c1", nome: "A Fazer", ordem: 1, cor: "",
      tarefas: [
        tarefa({ id: "t1", titulo: "Ligar pro cliente" }),
        tarefa({
          id: "t2", titulo: "Revisar layout", origem: "projeto",
          read_only: true, projeto_id: "p1", projeto_nome: "Website",
        }),
      ],
    },
    { id: "c2", nome: "Concluído", ordem: 2, cor: "", tarefas: [] },
  ];
}

describe("EquipeKanbanBoard", () => {
  it("renderiza colunas e tarefas", () => {
    render(<EquipeKanbanBoard colunas={colunas()} onAbrirTarefa={vi.fn()} />);
    expect(screen.getByText("A Fazer")).toBeInTheDocument();
    expect(screen.getByText("Concluído")).toBeInTheDocument();
    expect(screen.getByText("Ligar pro cliente")).toBeInTheDocument();
    // coluna vazia mostra o estado vazio
    expect(screen.getByText("Nenhuma tarefa")).toBeInTheDocument();
  });

  it('mostra o badge "Projeto X" nas tarefas de projeto', () => {
    render(<EquipeKanbanBoard colunas={colunas()} onAbrirTarefa={vi.fn()} />);
    expect(screen.getByText("Projeto Website")).toBeInTheDocument();
  });

  it("clicar numa tarefa dispara onAbrirTarefa", () => {
    const onAbrir = vi.fn();
    render(<EquipeKanbanBoard colunas={colunas()} onAbrirTarefa={onAbrir} />);
    fireEvent.click(screen.getByText("Ligar pro cliente"));
    expect(onAbrir).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }));
  });

  it("exibe o botão + quando permiteCriar", () => {
    const onNova = vi.fn();
    render(
      <EquipeKanbanBoard
        colunas={colunas()}
        permiteCriar
        onNovaTarefa={onNova}
        onAbrirTarefa={vi.fn()}
      />
    );
    fireEvent.click(screen.getAllByTitle(/Nova tarefa em/)[0]);
    expect(onNova).toHaveBeenCalledWith("c1");
  });
});
