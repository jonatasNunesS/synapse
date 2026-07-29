/**
 * Modal de editar colunas: renderiza a lista de colunas ordenada e permite
 * disparar a criação de uma nova coluna.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EditarColunasModal } from "./EditarColunasModal";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Referências ESTÁVEIS entre renders (o SWR real também é estável). Sem isso,
// o useEffect([colunas]) do modal entraria em loop de render nos testes.
const { criarColuna, hook } = vi.hoisted(() => {
  const COLS = [
    { id: "c2", nome: "Em Andamento", ordem: 2, cor: "", criado_em: "" },
    { id: "c1", nome: "A Fazer", ordem: 1, cor: "", criado_em: "" },
    { id: "c3", nome: "Concluído", ordem: 3, cor: "", criado_em: "" },
  ];
  const criar = vi.fn().mockResolvedValue({});
  const ret = {
    colunas: COLS,
    isLoading: false,
    criarColuna: criar,
    atualizarColuna: vi.fn(),
    excluirColuna: vi.fn(),
    reordenarColunas: vi.fn(),
  };
  return { criarColuna: criar, hook: () => ret };
});
vi.mock("@/hooks/useEquipe", () => ({ useColunasEquipe: hook }));

beforeEach(() => criarColuna.mockClear());

describe("EditarColunasModal", () => {
  it("renderiza as colunas na ordem correta", () => {
    render(<EditarColunasModal onFechar={vi.fn()} onMudou={vi.fn()} />);
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    // Os inputs de nome vêm ordenados por `ordem` (A Fazer, Em Andamento, Concluído).
    // O último textbox é o campo "nova coluna" (vazio).
    expect(inputs[0].value).toBe("A Fazer");
    expect(inputs[1].value).toBe("Em Andamento");
    expect(inputs[2].value).toBe("Concluído");
  });

  it("adicionar nova coluna chama criarColuna", async () => {
    render(<EditarColunasModal onFechar={vi.fn()} onMudou={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Nome da nova coluna"), {
      target: { value: "Revisão" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Adicionar/ }));
    await waitFor(() => expect(criarColuna).toHaveBeenCalledWith({ nome: "Revisão" }));
  });
});
