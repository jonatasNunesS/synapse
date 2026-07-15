/**
 * Testes do modal de depósito/retirada.
 * O caso crítico: retirada maior que o saldo NÃO passa — o modal oferece
 * retirar o máximo ("A caixinha só tem R$ X. Quer retirar R$ X?").
 *
 * Nota: Intl.NumberFormat("pt-BR") separa "R$" do número com espaço
 * não-quebrável (U+00A0). Nas asserções de texto com valor usamos \s
 * (que casa o nbsp) ou consultamos por rótulo, evitando o espaço.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { OperacaoCaixinhaModal } from "./OperacaoCaixinhaModal";
import type { Caixinha } from "@/types/caixinhas";

const caixinha: Caixinha = {
  id: "cx1",
  nome: "Reserva",
  cor: "#22c55e",
  icone: "🎯",
  saldo: "100.00",
  meta: null,
  meta_atingida: false,
  progresso: null,
  criado_em: "2026-07-01T10:00:00Z",
  atualizado_em: "2026-07-01T10:00:00Z",
};

function digitarValor(v: string) {
  fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: v } });
}

describe("OperacaoCaixinhaModal — retirada", () => {
  it("retirada dentro do saldo confirma direto", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <OperacaoCaixinhaModal
        caixinha={caixinha}
        tipo="retirada"
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />
    );
    digitarValor("50");
    fireEvent.click(screen.getByRole("button", { name: /Retirar/ }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("50.00", ""));
  });

  it("retirada maior que o saldo oferece o máximo em vez de confirmar", () => {
    const onConfirm = vi.fn();
    render(
      <OperacaoCaixinhaModal
        caixinha={caixinha}
        tipo="retirada"
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />
    );
    digitarValor("150");
    fireEvent.click(screen.getByRole("button", { name: /Retirar/ }));

    expect(onConfirm).not.toHaveBeenCalled();
    const alerta = screen.getByRole("alert");
    expect(within(alerta).getByText(/A caixinha só tem/)).toBeInTheDocument();
    // Oferta pelo saldo real (100,00), não pelos 150 solicitados
    expect(
      within(alerta).getByRole("button", { name: /100,00/ })
    ).toBeInTheDocument();
  });

  it("aceitar a oferta retira o máximo disponível", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <OperacaoCaixinhaModal
        caixinha={caixinha}
        tipo="retirada"
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />
    );
    digitarValor("150");
    fireEvent.click(screen.getByRole("button", { name: /Retirar/ }));
    const alerta = screen.getByRole("alert");
    fireEvent.click(within(alerta).getByRole("button", { name: /100,00/ }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("100.00", ""));
  });

  it("cancelar a oferta mantém o modal sem confirmar", () => {
    const onConfirm = vi.fn();
    render(
      <OperacaoCaixinhaModal
        caixinha={caixinha}
        tipo="retirada"
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />
    );
    digitarValor("150");
    fireEvent.click(screen.getByRole("button", { name: /Retirar/ }));
    const alerta = screen.getByRole("alert");
    fireEvent.click(within(alerta).getByRole("button", { name: "Cancelar" }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("OperacaoCaixinhaModal — depósito", () => {
  it("mostra o saldo disponível como referência e confirma", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <OperacaoCaixinhaModal
        caixinha={caixinha}
        tipo="deposito"
        saldoDisponivel={8000}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText(/Saldo disponível:/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*8\.000,00/)).toBeInTheDocument();

    digitarValor("2000");
    fireEvent.click(screen.getByRole("button", { name: /Depositar/ }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("2000.00", ""));
  });

  it("valor vazio mantém o botão desabilitado", () => {
    render(
      <OperacaoCaixinhaModal
        caixinha={caixinha}
        tipo="deposito"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /Depositar/ })).toBeDisabled();
  });
});
