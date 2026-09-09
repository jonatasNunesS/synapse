/**
 * De quem foi a venda, do lado da tela.
 *
 * O que estes testes fixam é sobretudo quando a tela PERGUNTA. Pôr um cliente
 * numa venda que não tinha é aditivo e vai direto; trocar e tirar somem com a
 * venda do histórico de alguém, e por isso passam por confirmação.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

import { VendaClienteModal } from "./VendaClienteModal";
import type { Venda } from "@/types/vendas";

const definir = vi.fn();
vi.mock("@/hooks/useVendas", () => ({
  vendaCliente: { definir: (...args: unknown[]) => definir(...args) },
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

/** O seletor real busca na API; aqui vira uma lista de botões. */
vi.mock("@/components/clientes/ClienteSelect", () => ({
  ClienteSelect: ({
    onSelect,
  }: {
    onSelect: (c: { id: string; nome: string }) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onSelect({ id: "cli-1", nome: "Maria Souza" })}>
        escolher Maria Souza
      </button>
      <button type="button" onClick={() => onSelect({ id: "cli-2", nome: "João Lima" })}>
        escolher João Lima
      </button>
    </div>
  ),
}));

const onClose = vi.fn();
const onVinculada = vi.fn();

beforeEach(() => {
  definir.mockReset();
  definir.mockResolvedValue({});
  toastSuccess.mockReset();
  toastError.mockReset();
  onClose.mockReset();
  onVinculada.mockReset();
});

function venda(extra: Partial<Venda> = {}): Venda {
  return {
    id: "v-1",
    cliente: null,
    cliente_nome: null,
    data_venda: "2026-01-10",
    total: "100.00",
    status_pagamento: "pago",
    itens: [],
    ...extra,
  } as Venda;
}

function montar(extra: Partial<Venda> = {}) {
  render(
    <VendaClienteModal
      venda={venda(extra)}
      onClose={onClose}
      onVinculada={onVinculada}
    />
  );
}

/** O ConfirmDialog aberto por cima do modal. */
function dialogo(titulo: string) {
  return screen.getByText(titulo).closest("div.fixed") as HTMLElement;
}

describe("Venda avulsa ganha cliente", () => {
  it("escolher vincula direto — não há nada a perder", async () => {
    montar();

    fireEvent.click(screen.getByRole("button", { name: /escolher maria souza/i }));

    await waitFor(() => expect(definir).toHaveBeenCalledWith("v-1", "cli-1"));
    expect(toastSuccess).toHaveBeenCalledWith("Venda vinculada a Maria Souza.");
    expect(onVinculada).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("não oferece tirar o cliente de quem não tem", () => {
    montar();
    expect(
      screen.queryByRole("button", { name: /tirar o cliente/i })
    ).not.toBeInTheDocument();
  });

  it("diz o que o vínculo não mexe", () => {
    // A dúvida que a pessoa tem ao clicar, respondida antes de ela clicar.
    montar();
    expect(screen.getByText(/não mudam/i)).toBeInTheDocument();
  });
});

describe("GUARDA: trocar e tirar pedem confirmação", () => {
  it("trocar não envia nada antes de confirmar", async () => {
    montar({ cliente: "cli-1", cliente_nome: "Maria Souza" });

    fireEvent.click(screen.getByRole("button", { name: /escolher joão lima/i }));

    expect(await screen.findByText("Trocar o cliente")).toBeInTheDocument();
    expect(definir).not.toHaveBeenCalled();
  });

  it("a confirmação diz de quem sai e para quem vai", async () => {
    montar({ cliente: "cli-1", cliente_nome: "Maria Souza" });
    fireEvent.click(screen.getByRole("button", { name: /escolher joão lima/i }));

    const texto = dialogo("Trocar o cliente").textContent ?? "";
    expect(texto).toContain("Maria Souza");
    expect(texto).toContain("João Lima");
    expect(texto).toContain("sai do histórico");
  });

  it("confirmar troca envia o cliente novo", async () => {
    montar({ cliente: "cli-1", cliente_nome: "Maria Souza" });
    fireEvent.click(screen.getByRole("button", { name: /escolher joão lima/i }));

    fireEvent.click(
      within(dialogo("Trocar o cliente")).getByRole("button", { name: "Trocar" })
    );

    await waitFor(() => expect(definir).toHaveBeenCalledWith("v-1", "cli-2"));
  });

  it("cancelar a troca não muda nada e deixa o modal aberto", async () => {
    montar({ cliente: "cli-1", cliente_nome: "Maria Souza" });
    fireEvent.click(screen.getByRole("button", { name: /escolher joão lima/i }));

    fireEvent.click(
      within(dialogo("Trocar o cliente")).getByRole("button", { name: /cancelar/i })
    );

    await waitFor(() =>
      expect(screen.queryByText("Trocar o cliente")).not.toBeInTheDocument()
    );
    expect(definir).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("tirar o cliente não envia nada antes de confirmar", async () => {
    montar({ cliente: "cli-1", cliente_nome: "Maria Souza" });

    fireEvent.click(screen.getByRole("button", { name: /tirar o cliente/i }));

    expect(await screen.findByText("Tirar o cliente")).toBeInTheDocument();
    expect(definir).not.toHaveBeenCalled();
  });

  it("confirmar desvincula mandando null", async () => {
    montar({ cliente: "cli-1", cliente_nome: "Maria Souza" });
    fireEvent.click(screen.getByRole("button", { name: /tirar o cliente/i }));

    fireEvent.click(
      within(dialogo("Tirar o cliente")).getByRole("button", { name: "Tirar" })
    );

    await waitFor(() => expect(definir).toHaveBeenCalledWith("v-1", null));
    expect(toastSuccess).toHaveBeenCalledWith("Venda desvinculada do cliente.");
  });
});

describe("Quando o backend recusa", () => {
  it("mostra o motivo e mantém o modal aberto", async () => {
    definir.mockRejectedValue(new Error("Cliente não encontrado."));
    montar();

    fireEvent.click(screen.getByRole("button", { name: /escolher maria souza/i }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Cliente não encontrado.",
        expect.anything()
      )
    );
    expect(onClose).not.toHaveBeenCalled();
    // E dá para tentar de novo: o botão não ficou travado.
    expect(screen.getByRole("button", { name: /escolher joão lima/i })).toBeEnabled();
  });
});

describe("O título diz o que a ação é", () => {
  it.each([
    [null, "Vincular a um cliente"],
    ["Maria Souza", "Trocar o cliente da venda"],
  ])("cliente %s → %s", (nome, titulo) => {
    montar({ cliente_nome: nome as string | null });
    expect(screen.getByRole("heading", { name: titulo })).toBeInTheDocument();
  });
});
