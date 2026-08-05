/**
 * Módulos configuráveis na página do cliente:
 * - Follow-up salvo só oferece a Agenda se o módulo Agenda estiver ligado;
 * - Com o Estoque desligado, a timeline não oferece "descontar do estoque".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useAppStore } from "@/store/useAppStore";
import type { ModulosEmpresa, Usuario } from "@/types/auth";
import type { InteracaoCliente } from "@/types/clientes";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "cli-1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

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
  proximo_followup: null as string | null,
  followup_atrasado: false,
  cpf_cnpj: null,
  endereco: null,
  cep: null,
  criado_em: "2026-07-01T10:00:00Z",
  criado_por_nome: "Maria",
};

/** Venda com movimentação de estoque vinculada (habilita a ação na timeline). */
const venda: InteracaoCliente = {
  id: "int-1",
  tipo: "venda",
  tipo_display: "Venda",
  titulo: "Venda inicial",
  descricao: null,
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
} as InteracaoCliente;

vi.mock("@/hooks/useClientes", () => ({
  useClienteDetalhe: () => ({
    cliente,
    loading: false,
    carregar: vi.fn(),
    setCliente: vi.fn(),
  }),
  useInteracoes: () => ({
    interacoes: [venda],
    loading: false,
    carregar: vi.fn(),
    registrar: vi.fn(),
    editar: vi.fn(),
    apagar: vi.fn(),
    registrarFinanceiro: vi.fn(),
    apagarComAjustes: vi.fn(),
    criarEventoFollowup: vi.fn(),
    baixarEstoque: vi.fn(),
  }),
}));

// api.patch devolve o cliente já com um follow-up novo → dispara a oferta da Agenda
const patch = vi.fn().mockResolvedValue({
  success: true,
  data: { ...cliente, proximo_followup: "2026-09-10" },
});
vi.mock("@/lib/api", async () => {
  const real = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...real,
    api: { patch: (...args: unknown[]) => patch(...args), delete: vi.fn(), post: vi.fn() },
  };
});

import ClienteDetalhePage from "./page";

function setModulos(modulos: Partial<ModulosEmpresa>) {
  useAppStore.setState({ usuario: { id: "u1", modulos } as unknown as Usuario });
}

/** Abre o form de edição do cliente e salva (o patch já traz o follow-up). */
async function salvarClienteComFollowup() {
  render(<ClienteDetalhePage />);
  // "Editar" do cabeçalho (o da timeline é "Editar interação")
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
  fireEvent.click(screen.getByRole("button", { name: /Salvar Alterações/i }));
  await waitFor(() => expect(patch).toHaveBeenCalled());
}

beforeEach(() => {
  patch.mockClear();
  useAppStore.setState({ usuario: null });
});

describe("Cliente × módulo Agenda", () => {
  it("com Agenda DESLIGADA não oferece criar o evento do follow-up", async () => {
    setModulos({ agenda: false, estoque: true });
    await salvarClienteComFollowup();

    // Dá tempo do modal aparecer se fosse aparecer
    await waitFor(() =>
      expect(screen.queryByText("Editar Cliente")).not.toBeInTheDocument()
    );
    expect(screen.queryByText("Adicionar à Agenda?")).not.toBeInTheDocument();
  });

  it("com Agenda LIGADA oferece adicionar o follow-up à Agenda", async () => {
    setModulos({ agenda: true, estoque: true });
    await salvarClienteComFollowup();

    await waitFor(() =>
      expect(screen.getByText("Adicionar à Agenda?")).toBeInTheDocument()
    );
  });
});

describe("Cliente × módulo Estoque", () => {
  it("com Estoque DESLIGADO a timeline não oferece descontar do estoque", () => {
    setModulos({ estoque: false, agenda: true });
    render(<ClienteDetalhePage />);
    expect(
      screen.queryByRole("button", { name: /Descontar do estoque/i })
    ).not.toBeInTheDocument();
  });

  it("com Estoque LIGADO a ação de descontar aparece na venda", () => {
    setModulos({ estoque: true, agenda: true });
    render(<ClienteDetalhePage />);
    expect(
      screen.getByRole("button", { name: /Descontar do estoque/i })
    ).toBeInTheDocument();
  });
});
