/**
 * AdicionarEstoqueModal (compra → entrada de estoque):
 * - compra já vinculada mostra o aviso e não oferece de novo;
 * - fluxo normal: pergunta → seleção → confirma chamando o hook + toast.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AdicionarEstoqueModal } from "./AdicionarEstoqueModal";
import type { CompraFornecedor } from "@/types/fornecedores";
import type { ProdutoList } from "@/types/estoque";

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) },
}));

const adicionarAoEstoque = vi.fn();
vi.mock("@/hooks/useFornecedores", () => ({
  useComprasFornecedor: () => ({ adicionarAoEstoque }),
}));

const produto: ProdutoList = {
  id: "p1", nome: "Camisa Branca", sku: "CAM-1", categoria_nome: null,
  categoria_cor: null, preco_venda: 50, estoque_atual: 10, estoque_minimo: 5,
  status_estoque: "ok", unidade: "unidade", imagem_url: "", ativo: true,
};
vi.mock("@/hooks/useEstoque", () => ({
  useProdutos: () => ({ produtos: [produto], loading: false, listar: vi.fn() }),
}));

function compra(overrides: Partial<CompraFornecedor> = {}): CompraFornecedor {
  return {
    id: "co1", fornecedor: "f1", fornecedor_nome: "Tecido SA",
    descricao: "50 camisas brancas", valor: "500.00", data_compra: "2026-07-22",
    numero_nf: null, status: "pendente", status_display: "Pendente",
    data_pagamento: null, observacoes: null, criado_por_nome: "Ana",
    criado_em: "2026-07-22T10:00:00Z", ja_no_estoque: false, ...overrides,
  };
}

beforeEach(() => {
  toastSuccess.mockClear();
  toastError.mockClear();
  adicionarAoEstoque.mockReset();
});

describe("AdicionarEstoqueModal", () => {
  it("compra já no estoque mostra aviso e não oferece adicionar", () => {
    render(<AdicionarEstoqueModal compra={compra({ ja_no_estoque: true })} onClose={vi.fn()} />);
    expect(
      screen.getByText("Esta compra já foi adicionada ao estoque.")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Sim, adicionar ao estoque" })
    ).not.toBeInTheDocument();
  });

  it("mostra a pergunta com a descrição da compra", () => {
    render(<AdicionarEstoqueModal compra={compra()} onClose={vi.fn()} />);
    expect(screen.getByText("Deseja adicionar ao estoque?")).toBeInTheDocument();
    expect(screen.getByText("50 camisas brancas")).toBeInTheDocument();
  });

  it("fluxo completo: confirma entrada chamando o hook e dá toast", async () => {
    adicionarAoEstoque.mockResolvedValue({});
    render(<AdicionarEstoqueModal compra={compra()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Sim, adicionar ao estoque" }));
    fireEvent.click(screen.getByText("Camisa Branca"));
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar entrada/ }));

    await waitFor(() => expect(adicionarAoEstoque).toHaveBeenCalledWith("co1", "p1", 50));
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining("Entrada de 50"))
    );
  });
});
