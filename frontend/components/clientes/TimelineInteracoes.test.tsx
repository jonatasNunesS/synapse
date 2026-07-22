/**
 * Timeline de interações: cada item mostra as ações de editar e apagar, e
 * clicá-las dispara os callbacks corretos (a página abre o modal / o
 * ConfirmDialog a partir daí).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { TimelineInteracoes } from "./TimelineInteracoes";
import type { InteracaoCliente } from "@/types/clientes";

const interacao: InteracaoCliente = {
  id: "int-1",
  tipo: "ligacao",
  tipo_display: "Ligação",
  titulo: "Ligação de apresentação",
  descricao: "Falamos sobre o produto",
  valor: null,
  data_interacao: "2026-07-20T14:30:00Z",
  proximo_followup: null,
  criado_por_nome: "Maria",
  criado_em: "2026-07-20T14:30:00Z",
};

describe("TimelineInteracoes", () => {
  it("mostra os botões de editar e apagar em cada interação", () => {
    render(
      <TimelineInteracoes
        interacoes={[interacao]}
        onEditar={vi.fn()}
        onApagar={vi.fn()}
      />
    );
    expect(
      screen.getByRole("button", { name: "Editar interação" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Excluir interação" })
    ).toBeInTheDocument();
  });

  it("clicar em editar dispara onEditar com a interação", () => {
    const onEditar = vi.fn();
    render(
      <TimelineInteracoes interacoes={[interacao]} onEditar={onEditar} onApagar={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Editar interação" }));
    expect(onEditar).toHaveBeenCalledWith(interacao);
  });

  it("clicar em apagar dispara onApagar com a interação (não deleta direto)", () => {
    const onApagar = vi.fn();
    render(
      <TimelineInteracoes interacoes={[interacao]} onEditar={vi.fn()} onApagar={onApagar} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Excluir interação" }));
    expect(onApagar).toHaveBeenCalledWith(interacao);
  });

  it("sem interações mostra o estado vazio", () => {
    render(<TimelineInteracoes interacoes={[]} />);
    expect(screen.getByText("Nenhuma interação registrada.")).toBeInTheDocument();
  });

  it("sem callbacks, os botões de ação não aparecem", () => {
    render(<TimelineInteracoes interacoes={[interacao]} />);
    const item = screen.getByText("Ligação de apresentação").closest("div")!;
    expect(
      within(item.parentElement as HTMLElement).queryByRole("button", {
        name: "Editar interação",
      })
    ).not.toBeInTheDocument();
  });
});
