/**
 * A cobrança de uma venda fiada, do lado da tela.
 *
 * As três respostas do fluxo antigo, e sobretudo a que tem armadilha: receber
 * menos que o combinado NÃO quita a venda. Se a tela deixasse isso parecer
 * quitação, o resto da dívida sumiria sem ninguém perceber.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { VendaFiadoModal } from "./VendaFiadoModal";
import type { Venda } from "@/types/vendas";

const confirmar = vi.fn();
const adiar = vi.fn();
const cancelar = vi.fn();

vi.mock("@/hooks/useVendas", () => ({
  vendaFiado: {
    confirmar: (...args: unknown[]) => confirmar(...args),
    adiar: (...args: unknown[]) => adiar(...args),
    cancelar: (...args: unknown[]) => cancelar(...args),
  },
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

const onClose = vi.fn();
const onResolvida = vi.fn();

beforeEach(() => {
  confirmar.mockReset();
  adiar.mockReset();
  cancelar.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  onClose.mockReset();
  onResolvida.mockReset();
});

function venda(extra: Partial<Venda> = {}): Venda {
  return {
    id: "v-1",
    cliente: null,
    cliente_nome: null,
    data_venda: "2026-01-10",
    subtotal: "100.00",
    desconto: "0",
    total: "100.00",
    forma_pagamento: "",
    status_pagamento: "pendente",
    data_prevista_pagamento: "2026-01-20",
    devedor: "",
    valor_recebido: "0",
    saldo_devedor: "100.00",
    pagamento_atrasado: false,
    dias_para_vencer: 0,
    observacoes: "",
    itens: [],
    ja_baixou_estoque: false,
    tem_itens_com_produto: true,
    tem_lancamento_financeiro: false,
    criado_em: "2026-01-10T10:00:00Z",
    atualizado_em: "2026-01-10T10:00:00Z",
    ...extra,
  } as Venda;
}

function montar(extra: Partial<Venda> = {}) {
  render(
    <VendaFiadoModal
      venda={venda(extra)}
      onClose={onClose}
      onResolvida={onResolvida}
    />
  );
}

/** Texto sem o espaço não-quebrável que o Intl põe depois de "R$". */
function limpo(texto: string | null | undefined): string {
  return (texto ?? "").replace(/ /g, " ");
}

describe("De quem se cobra", () => {
  it("cliente cadastrado aparece no título", () => {
    montar({ cliente_nome: "Maria Souza" });
    expect(limpo(screen.getByRole("heading").textContent)).toBe(
      "Maria Souza ficou de pagar R$ 100,00"
    );
  });

  it("sem cliente, o rótulo livre dá o nome", () => {
    montar({ devedor: "João da feira" });
    expect(limpo(screen.getByRole("heading").textContent)).toContain(
      "João da feira"
    );
  });

  it("sem nenhum dos dois, diz o que dá para dizer", () => {
    montar();
    expect(limpo(screen.getByRole("heading").textContent)).toBe(
      "Venda fiada de R$ 100,00"
    );
  });
});

describe("Confirmar", () => {
  it("recebeu tudo: confirma sem perguntar mais nada", async () => {
    confirmar.mockResolvedValue({
      venda: venda({ status_pagamento: "pago" }),
      recebido: "100.00",
      saldo_devedor: "0",
      quitou: true,
    });
    montar();

    fireEvent.click(screen.getByRole("button", { name: /confirmar pagamento/i }));
    fireEvent.click(screen.getByRole("button", { name: /^confirmar$/i }));

    await waitFor(() => expect(confirmar).toHaveBeenCalledWith("v-1", {}));
    expect(onResolvida).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("mostra o motivo quando o backend recusa", async () => {
    confirmar.mockRejectedValue(new Error("Este pagamento já foi resolvido."));
    montar();

    fireEvent.click(screen.getByRole("button", { name: /confirmar pagamento/i }));
    fireEvent.click(screen.getByRole("button", { name: /^confirmar$/i }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Este pagamento já foi resolvido.",
        expect.anything()
      )
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("GUARDA: parcial não é quitação", () => {
  it("receber menos abre a pergunta do saldo em vez de confirmar", async () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /confirmar pagamento/i }));
    fireEvent.change(screen.getByLabelText(/valor recebido/i), {
      target: { value: "60" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^confirmar$/i }));

    expect(await screen.findByTestId("fiado-saldo")).toBeInTheDocument();
    expect(limpo(screen.getByTestId("fiado-saldo").textContent)).toContain(
      "R$ 40,00"
    );
    // Nada foi enviado ainda: a pessoa ainda vai dizer quando cobrar o resto.
    expect(confirmar).not.toHaveBeenCalled();
  });

  it("manda o valor recebido e a nova data do saldo", async () => {
    confirmar.mockResolvedValue({
      venda: venda({ valor_recebido: "60.00", saldo_devedor: "40.00" }),
      recebido: "60.00",
      saldo_devedor: "40.00",
      quitou: false,
    });
    montar();
    fireEvent.click(screen.getByRole("button", { name: /confirmar pagamento/i }));
    fireEvent.change(screen.getByLabelText(/valor recebido/i), {
      target: { value: "60" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^confirmar$/i }));

    fireEvent.change(await screen.findByLabelText(/nova previsão/i), {
      target: { value: "2026-02-10" },
    });
    fireEvent.click(screen.getByRole("button", { name: /cobrar nesta data/i }));

    await waitFor(() =>
      expect(confirmar).toHaveBeenCalledWith("v-1", {
        valor_recebido: "60",
        data_prevista_saldo: "2026-02-10",
      })
    );
  });

  it("o aviso diz quanto ainda falta, não 'pago'", async () => {
    confirmar.mockResolvedValue({
      venda: venda(),
      recebido: "60.00",
      saldo_devedor: "40.00",
      quitou: false,
    });
    montar();
    fireEvent.click(screen.getByRole("button", { name: /confirmar pagamento/i }));
    fireEvent.change(screen.getByLabelText(/valor recebido/i), {
      target: { value: "60" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^confirmar$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /manter a data atual/i }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(limpo(toastSuccess.mock.calls[0][0])).toBe(
      "Recebido R$ 60,00. Falta R$ 40,00."
    );
  });

  it("cobrar numa nova data exige escolher a data", async () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /confirmar pagamento/i }));
    fireEvent.change(screen.getByLabelText(/valor recebido/i), {
      target: { value: "60" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^confirmar$/i }));

    expect(
      await screen.findByRole("button", { name: /cobrar nesta data/i })
    ).toBeDisabled();
  });
});

describe("Adiar e cancelar", () => {
  it("adia pelo número de dias escolhido", async () => {
    adiar.mockResolvedValue(venda({ data_prevista_pagamento: "2026-01-27" }));
    montar();

    fireEvent.click(screen.getByRole("button", { name: /adiar/i }));
    fireEvent.change(screen.getByLabelText(/dias para adiar/i), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^adiar$/i }));

    await waitFor(() => expect(adiar).toHaveBeenCalledWith("v-1", 10));
    expect(onResolvida).toHaveBeenCalled();
  });

  it("nunca adia por menos de um dia", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /adiar/i }));

    fireEvent.change(screen.getByLabelText(/dias para adiar/i), {
      target: { value: "0" },
    });

    expect(screen.getByLabelText(/dias para adiar/i)).toHaveValue(1);
  });

  it("cancelar para de cobrar", async () => {
    cancelar.mockResolvedValue(venda({ status_pagamento: "cancelado" }));
    montar();

    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    await waitFor(() => expect(cancelar).toHaveBeenCalledWith("v-1"));
    expect(toastSuccess).toHaveBeenCalledWith("Essa venda não será cobrada.");
  });
});

describe("O que já entrou aparece", () => {
  it("venda com recebimento anterior mostra quanto já veio", () => {
    montar({ valor_recebido: "60.00", saldo_devedor: "40.00" });

    expect(limpo(screen.getByTestId("venda-fiado").textContent)).toContain(
      "Já recebeu R$ 60,00"
    );
    // E cobra só o que falta.
    expect(limpo(screen.getByRole("heading").textContent)).toContain("R$ 40,00");
  });
});
