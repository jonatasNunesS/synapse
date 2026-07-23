/**
 * FiadoDecisaoModal: confirmar / adiar / cancelar a cobrança de uma venda fiada,
 * incluindo o fluxo de valor parcial (oferece registrar o restante).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FiadoDecisaoModal } from "./FiadoDecisaoModal";
import type { InteracaoCliente } from "@/types/clientes";

const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (m: string) => toastSuccess(m), error: vi.fn() },
}));

const confirmarPagamento = vi.fn().mockResolvedValue({});
const adiarPagamento = vi.fn().mockResolvedValue({});
const cancelarPagamento = vi.fn().mockResolvedValue({});
vi.mock("@/hooks/useClientes", () => ({
  useInteracoes: () => ({ confirmarPagamento, adiarPagamento, cancelarPagamento }),
}));

const venda: InteracaoCliente = {
  id: "v1", tipo: "venda", tipo_display: "Venda", titulo: "Casamento - sinal",
  descricao: null, valor: "500.00", data_interacao: "2026-07-22T10:00:00Z",
  proximo_followup: null, status_pagamento: "pendente",
  status_pagamento_display: "Pendente", data_prevista_pagamento: "2026-07-22",
  pagamento_atrasado: true, dias_para_vencer: 0,
  criado_por_nome: "Ana", criado_em: "2026-07-22T10:00:00Z",
};

function renderModal() {
  render(
    <FiadoDecisaoModal
      clienteId="c1"
      clienteNome="Ana & João"
      interacao={venda}
      onClose={vi.fn()}
      onResolved={vi.fn()}
    />
  );
}

beforeEach(() => {
  toastSuccess.mockClear();
  confirmarPagamento.mockClear();
  adiarPagamento.mockClear();
  cancelarPagamento.mockClear();
});

describe("FiadoDecisaoModal", () => {
  it("mostra a pergunta com cliente e referência", () => {
    renderModal();
    expect(screen.getByText(/Ana & João ficou de pagar/)).toBeInTheDocument();
    expect(screen.getByText("Casamento - sinal")).toBeInTheDocument();
  });

  it("confirmar valor cheio → chama confirmarPagamento e dá toast", async () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /Confirmar pagamento/ }));
    // valor default já é o original (500) → confirma direto
    fireEvent.click(screen.getByRole("button", { name: /^Confirmar$/ }));
    await waitFor(() => expect(confirmarPagamento).toHaveBeenCalled());
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining("confirmado"))
    );
  });

  it("valor parcial → pergunta sobre o restante e cria a pendência", async () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /Confirmar pagamento/ }));
    fireEvent.change(screen.getByLabelText("Valor recebido"), { target: { value: "300" } });
    fireEvent.click(screen.getByRole("button", { name: /^Confirmar$/ }));

    // Aparece a pergunta do restante (faltou 200)
    expect(screen.getByText(/Faltou/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Previsão do restante"), {
      target: { value: "2026-09-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Sim, criar pendência/ }));

    await waitFor(() =>
      expect(confirmarPagamento).toHaveBeenCalledWith("v1", {
        valor_confirmado: "300",
        criar_restante: true,
        data_prevista_restante: "2026-09-01",
      })
    );
  });

  it("adiar → chama adiarPagamento com os dias", async () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /Adiar/ }));
    fireEvent.change(screen.getByLabelText("Dias para adiar"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /^Adiar$/ }));
    await waitFor(() => expect(adiarPagamento).toHaveBeenCalledWith("v1", 10));
  });

  it("cancelar → chama cancelarPagamento", async () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/ }));
    await waitFor(() => expect(cancelarPagamento).toHaveBeenCalledWith("v1"));
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Essa venda não será cobrada.")
    );
  });
});
