/**
 * Testes do CaixinhaCard: nome, saldo, barra de progresso e badge de meta.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CaixinhaCard } from "./CaixinhaCard";
import type { Caixinha } from "@/types/caixinhas";

function caixinha(extra: Partial<Caixinha> = {}): Caixinha {
  return {
    id: "cx1",
    nome: "Reserva de emergência",
    cor: "#22c55e",
    icone: "🎯",
    saldo: "500.00",
    meta: "2000.00",
    meta_atingida: false,
    progresso: 25.0,
    criado_em: "2026-07-01T10:00:00Z",
    atualizado_em: "2026-07-01T10:00:00Z",
    ...extra,
  };
}

const handlers = {
  onDepositar: vi.fn(),
  onRetirar: vi.fn(),
  onAbrir: vi.fn(),
};

describe("CaixinhaCard", () => {
  it("renderiza nome, saldo e progresso quando há meta", () => {
    render(<CaixinhaCard caixinha={caixinha()} {...handlers} />);
    expect(screen.getByText("Reserva de emergência")).toBeInTheDocument();
    expect(screen.getByText("R$ 500,00")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByText(/Meta: R\$ 2\.000,00/)).toBeInTheDocument();
  });

  it("meta atingida mostra o badge 🎉", () => {
    render(
      <CaixinhaCard
        caixinha={caixinha({ saldo: "2000.00", meta_atingida: true, progresso: 100 })}
        {...handlers}
      />
    );
    expect(screen.getByText("Meta atingida! 🎉")).toBeInTheDocument();
  });

  it("sem meta: não mostra barra nem badge", () => {
    render(
      <CaixinhaCard
        caixinha={caixinha({ meta: null, progresso: null })}
        {...handlers}
      />
    );
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText(/Meta atingida/)).not.toBeInTheDocument();
  });

  it("botões de depositar/retirar disparam os handlers", () => {
    const onDepositar = vi.fn();
    const onRetirar = vi.fn();
    render(
      <CaixinhaCard
        caixinha={caixinha()}
        onDepositar={onDepositar}
        onRetirar={onRetirar}
        onAbrir={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText("Depositar"));
    fireEvent.click(screen.getByText("Retirar"));
    expect(onDepositar).toHaveBeenCalledTimes(1);
    expect(onRetirar).toHaveBeenCalledTimes(1);
  });

  it("caixinha vazia desabilita o botão de retirar", () => {
    render(
      <CaixinhaCard
        caixinha={caixinha({ saldo: "0.00", progresso: 0 })}
        {...handlers}
      />
    );
    expect(screen.getByText("Retirar").closest("button")).toBeDisabled();
  });
});
