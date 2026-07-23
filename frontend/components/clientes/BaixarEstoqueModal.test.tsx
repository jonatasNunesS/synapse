/**
 * BaixarEstoqueModal (venda → saída de estoque):
 * - passo 1 mostra a venda (cliente + valor);
 * - passo 2 mostra o preview "Estoque atual: X → vai ficar: Y";
 * - estoque insuficiente vira soft block ("Quer registrar saída de X?").
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BaixarEstoqueModal } from "./BaixarEstoqueModal";
import type { InteracaoCliente } from "@/types/clientes";
import type { ProdutoList } from "@/types/estoque";

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) },
}));

const baixarEstoque = vi.fn();
vi.mock("@/hooks/useClientes", () => ({
  useInteracoes: () => ({ baixarEstoque }),
}));

const produto: ProdutoList = {
  id: "p1", nome: "Camisa Branca", sku: "CAM-1", categoria_nome: null,
  categoria_cor: null, preco_venda: 50, estoque_atual: 30, estoque_minimo: 5,
  status_estoque: "ok", unidade: "unidade", imagem_url: "", ativo: true,
};
vi.mock("@/hooks/useEstoque", () => ({
  useProdutos: () => ({ produtos: [produto], loading: false, listar: vi.fn() }),
}));

const venda: InteracaoCliente = {
  id: "v1", tipo: "venda", tipo_display: "Venda", titulo: "Venda de camisas",
  descricao: null, valor: "500.00", data_interacao: "2026-07-22T10:00:00Z",
  proximo_followup: null, status_pagamento: "nao_se_aplica",
  status_pagamento_display: "Não se aplica", data_prevista_pagamento: null,
  pagamento_atrasado: false, dias_para_vencer: null,
  criado_por_nome: "Ana", criado_em: "2026-07-22T10:00:00Z",
};

function abrirSelecao() {
  render(
    <BaixarEstoqueModal
      clienteId="c1"
      clienteNome="Ana & João"
      interacao={venda}
      onClose={vi.fn()}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Sim, baixar estoque" }));
  fireEvent.click(screen.getByText("Camisa Branca"));
}

beforeEach(() => {
  toastSuccess.mockClear();
  toastError.mockClear();
  baixarEstoque.mockReset();
});

describe("BaixarEstoqueModal", () => {
  it("passo 1 mostra a venda (cliente e valor)", () => {
    render(
      <BaixarEstoqueModal clienteId="c1" clienteNome="Ana & João" interacao={venda} onClose={vi.fn()} />
    );
    expect(screen.getByText("Deseja baixar do estoque?")).toBeInTheDocument();
    expect(screen.getByText("Ana & João")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?500,00/)).toBeInTheDocument();
  });

  it("mostra o preview de estoque antes → depois", () => {
    abrirSelecao();
    // Default qty = 1 → 30 vira 29 (o preview é único: "→ vai ficar:")
    expect(screen.getByText(/Estoque atual: 30 → vai ficar:/)).toBeInTheDocument();
    expect(screen.getByText("29")).toBeInTheDocument();

    // Muda quantidade → preview atualiza
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "5" } });
    expect(screen.getByText("25")).toBeInTheDocument();
  });

  it("confirma a saída chamando baixarEstoque e dá toast de sucesso", async () => {
    baixarEstoque.mockResolvedValue({});
    abrirSelecao();
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar saída/ }));
    await waitFor(() => expect(baixarEstoque).toHaveBeenCalledWith("v1", "p1", 5));
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining("Saída de 5"))
    );
  });

  it("estoque insuficiente vira soft block com o saldo real", async () => {
    baixarEstoque.mockRejectedValueOnce({
      error: { code: "ESTOQUE_INSUFICIENTE", message: "insuficiente", details: { saldo_atual: "3" } },
    });
    abrirSelecao();
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar saída/ }));

    // Aparece o soft block oferecendo baixar o que há (3)
    await waitFor(() =>
      expect(screen.getByText(/Quer registrar saída de 3/)).toBeInTheDocument()
    );
    expect(toastError).not.toHaveBeenCalled();

    // Confirma baixar 3 → segunda chamada com a quantidade capada
    baixarEstoque.mockResolvedValueOnce({});
    fireEvent.click(screen.getByRole("button", { name: /Confirmar 3/ }));
    await waitFor(() => expect(baixarEstoque).toHaveBeenLastCalledWith("v1", "p1", 3));
  });
});
