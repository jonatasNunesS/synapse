/**
 * Após registrar uma compra, o modal "Adicionar ao estoque" aparece.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { HistoricoCompras } from "./HistoricoCompras";
import type { CompraFornecedor } from "@/types/fornecedores";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const compraCriada: CompraFornecedor = {
  id: "co1", fornecedor: "f1", fornecedor_nome: "Tecido SA",
  descricao: "50 camisas brancas", valor: "500.00", data_compra: "2026-07-22",
  numero_nf: null, status: "pendente", status_display: "Pendente",
  data_pagamento: null, observacoes: null, criado_por_nome: "Ana",
  criado_em: "2026-07-22T10:00:00Z", ja_no_estoque: false,
};

const criar = vi.fn().mockResolvedValue(compraCriada);
vi.mock("@/hooks/useFornecedores", () => ({
  useComprasFornecedor: () => ({
    data: [], total: 0, loading: false, error: null,
    fetch: vi.fn(), criar, atualizar: vi.fn(), deletar: vi.fn(),
    adicionarAoEstoque: vi.fn(),
  }),
}));

vi.mock("@/hooks/useEstoque", () => ({
  useProdutos: () => ({ produtos: [], loading: false, listar: vi.fn() }),
}));

beforeEach(() => criar.mockClear());

describe("HistoricoCompras → adicionar ao estoque", () => {
  it("mostra o modal de estoque após registrar a compra", async () => {
    render(<HistoricoCompras fornecedorId="f1" />);

    // Abre o formulário de nova compra
    fireEvent.click(screen.getByRole("button", { name: /Registrar Compra/ }));

    // Preenche os campos obrigatórios dentro do diálogo do formulário
    const dialog = screen.getByText("Registrar Compra", { selector: "h3" }).closest("div")!
      .parentElement as HTMLElement;
    fireEvent.change(within(dialog).getByPlaceholderText("Descrição da compra"), {
      target: { value: "50 camisas brancas" },
    });
    fireEvent.change(within(dialog).getByPlaceholderText("0,00"), {
      target: { value: "500" },
    });

    // Submete (botão dentro do formulário)
    const submit = within(dialog).getByRole("button", { name: /Registrar Compra/ });
    fireEvent.click(submit);

    await waitFor(() => expect(criar).toHaveBeenCalled());
    // O modal de estoque aparece
    await waitFor(() =>
      expect(screen.getByText("Deseja adicionar ao estoque?")).toBeInTheDocument()
    );
  });
});
