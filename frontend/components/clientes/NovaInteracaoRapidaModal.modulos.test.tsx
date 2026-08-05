/**
 * Módulos configuráveis — com o Estoque desligado, registrar uma VENDA não
 * pergunta mais "Deseja baixar do estoque?": vai direto para o financeiro
 * (que é obrigatório). Com o módulo ligado, o fluxo continua o de sempre.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NovaInteracaoRapidaModal } from "./NovaInteracaoRapidaModal";
import { useAppStore } from "@/store/useAppStore";
import type { ModulosEmpresa, Usuario } from "@/types/auth";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const registrar = vi
  .fn()
  .mockResolvedValue({ id: "i1", tipo: "venda", valor: "150.00" });
vi.mock("@/hooks/useClientes", () => ({
  useInteracoes: () => ({
    registrar,
    registrarFinanceiro: vi.fn(),
    baixarEstoque: vi.fn(),
  }),
  useClientes: () => ({ clientes: [], loading: false, carregar: vi.fn() }),
}));
vi.mock("@/hooks/useEstoque", () => ({
  useProdutos: () => ({ produtos: [], loading: false, listar: vi.fn() }),
}));

function setModulos(modulos: Partial<ModulosEmpresa>) {
  useAppStore.setState({ usuario: { id: "u1", modulos } as unknown as Usuario });
}

/** Preenche e envia uma interação do tipo Venda. */
async function registrarVenda() {
  render(
    <NovaInteracaoRapidaModal
      clienteInicial={{ id: "c1", nome: "Padaria da Maria" }}
      onClose={vi.fn()}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Venda" }));
  fireEvent.change(screen.getByPlaceholderText(/Ligação de apresentação/), {
    target: { value: "Venda de bolos" },
  });
  fireEvent.change(screen.getByPlaceholderText("0,00"), {
    target: { value: "150.00" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
  await waitFor(() => expect(registrar).toHaveBeenCalled());
}

beforeEach(() => {
  registrar.mockClear();
  useAppStore.setState({ usuario: null });
});

describe("Venda × módulo Estoque", () => {
  it("com Estoque DESLIGADO não abre o modal de estoque, vai pro financeiro", async () => {
    setModulos({ estoque: false });
    await registrarVenda();

    await waitFor(() =>
      expect(screen.getByText("Registrar no financeiro")).toBeInTheDocument()
    );
    expect(screen.queryByText("Baixar do estoque")).not.toBeInTheDocument();
    expect(screen.queryByText("Deseja baixar do estoque?")).not.toBeInTheDocument();
  });

  it("com Estoque LIGADO o fluxo continua perguntando pela baixa", async () => {
    setModulos({ estoque: true });
    await registrarVenda();

    await waitFor(() =>
      expect(screen.getByText("Baixar do estoque")).toBeInTheDocument()
    );
    expect(screen.getByText("Deseja baixar do estoque?")).toBeInTheDocument();
  });
});
