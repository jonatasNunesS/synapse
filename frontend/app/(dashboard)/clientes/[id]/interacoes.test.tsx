/**
 * Fluxo de editar/apagar interações na página do cliente:
 * - apagar passa pelo ConfirmDialog (padrão do sistema), nunca window.confirm();
 * - após apagar com sucesso → toast "Interação excluída.";
 * - após salvar a edição → toast "Interação atualizada.".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { InteracaoCliente } from "@/types/clientes";

// ── Mocks ─────────────────────────────────────────────────────────────────────
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) },
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "cli-1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const interacao: InteracaoCliente = {
  id: "int-1",
  tipo: "venda",
  tipo_display: "Venda",
  titulo: "Venda inicial",
  descricao: "Primeira compra",
  valor: "500.00",
  data_interacao: "2026-07-20T14:30:00Z",
  proximo_followup: null,
  status_pagamento: "nao_se_aplica",
  status_pagamento_display: "Não se aplica",
  data_prevista_pagamento: null,
  pagamento_atrasado: false,
  dias_para_vencer: null,
  criado_por_nome: "Maria",
  criado_em: "2026-07-20T14:30:00Z",
};

const apagar = vi.fn().mockResolvedValue(undefined);
const editar = vi.fn().mockResolvedValue(interacao);
const carregar = vi.fn();
const carregarInteracoes = vi.fn();

const cliente = {
  id: "cli-1",
  nome: "Padaria da Maria",
  tipo_display: "Pessoa Jurídica",
  link_whatsapp: null,
  status_funil: "lead" as const,
  origem_display: "Indicação",
  email: "maria@padaria.com",
  telefone: "11999999999",
  cidade: "São Paulo",
  estado: "SP",
  observacoes: null,
  valor_total_compras: "500.00",
  quantidade_compras: 1,
  ticket_medio: "500.00",
  dias_sem_compra: 3,
  ultima_compra: "2026-07-20T14:30:00Z",
  proximo_followup: null,
  followup_atrasado: false,
  cpf_cnpj: null,
  endereco: null,
  cep: null,
  criado_em: "2026-07-01T10:00:00Z",
  criado_por_nome: "Maria",
};

vi.mock("@/hooks/useClientes", () => ({
  useClienteDetalhe: () => ({
    cliente,
    loading: false,
    carregar,
    setCliente: vi.fn(),
  }),
  useInteracoes: () => ({
    interacoes: [interacao],
    loading: false,
    carregar: carregarInteracoes,
    registrar: vi.fn(),
    editar,
    apagar,
  }),
}));

import ClienteDetalhePage from "./page";

describe("Cliente — editar/apagar interações", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    apagar.mockClear();
    editar.mockClear();
  });

  it("apagar abre o ConfirmDialog (não window.confirm) e só apaga ao confirmar", async () => {
    render(<ClienteDetalhePage />);

    // O ConfirmDialog de interação ainda não está na tela
    expect(screen.queryByText("Excluir interação")).not.toBeInTheDocument();

    // Ícone de lixeira na timeline (título "Excluir interação")
    fireEvent.click(screen.getByRole("button", { name: "Excluir interação" }));

    // ConfirmDialog apareceu; apagar ainda NÃO foi chamado
    const titulo = screen.getByText("Excluir interação");
    expect(titulo).toBeInTheDocument();
    expect(apagar).not.toHaveBeenCalled();

    // Confirma dentro do próprio diálogo (evita ambiguidade com o botão
    // "Excluir" do cabeçalho, que apaga o cliente)
    const dialog = titulo.closest("div.fixed") as HTMLElement;
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(apagar).toHaveBeenCalledWith("int-1"));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Interação excluída."));
  });

  it("salvar a edição chama editar e dispara toast de sucesso", async () => {
    render(<ClienteDetalhePage />);

    fireEvent.click(screen.getByRole("button", { name: "Editar interação" }));

    // Modal de edição abriu, pré-preenchido
    expect(screen.getByText("Editar Interação")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Venda inicial")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Salvar alterações/i }));

    await waitFor(() => expect(editar).toHaveBeenCalledWith("int-1", expect.any(Object)));
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Interação atualizada.")
    );
  });
});
