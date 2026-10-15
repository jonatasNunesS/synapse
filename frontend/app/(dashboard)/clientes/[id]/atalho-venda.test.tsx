/**
 * O atalho de venda no perfil do cliente aponta para `Venda`.
 *
 * Até esta leva, registrar uma venda a partir do cliente era escolher "Venda"
 * no formulário de interação. Esse caminho fechou: interação de venda não
 * alimentava métrica nenhuma, e era por isso que quem comprou R$ 450 mostrava
 * R$ 0,00 (B10).
 *
 * O que NÃO podia fechar junto é o atalho. Quem está olhando o perfil da Ana
 * e precisa registrar uma venda dela não deve ter de sair da tela, ir para
 * /vendas e procurar o nome num select. Então o botão continua — abrindo o
 * mesmo `VendaForm` da tela de Vendas, com o mesmo fluxo pós-venda, e com a
 * Ana já escolhida.
 *
 * A GUARDA desta suíte é a última asserção de cada teste: o formulário que
 * abre é o de venda e NÃO o de interação. Reapontar o atalho para o modal
 * antigo faz os dois primeiros testes falharem.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import type { Venda } from "@/types/vendas";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("@/lib/api", () => ({
  api: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  getErrorMessage: (e: unknown) =>
    e instanceof Error ? e.message : "Erro inesperado.",
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

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
  email: null,
  telefone: null,
  cidade: null,
  estado: null,
  observacoes: null,
  valor_total_compras: "0.00",
  valor_recebido: "0.00",
  valor_a_receber: "0.00",
  quantidade_compras: 0,
  ticket_medio: "0.00",
  dias_sem_compra: null,
  ultima_compra: null,
  proximo_followup: null,
  followup_atrasado: false,
  cpf_cnpj: null,
  endereco: null,
  cep: null,
  criado_em: "2026-07-01T10:00:00Z",
  criado_por_nome: "Maria",
};

const recarregarCliente = vi.fn().mockResolvedValue(undefined);

vi.mock("@/hooks/useClientes", () => ({
  useClienteDetalhe: () => ({
    cliente,
    loading: false,
    carregar: recarregarCliente,
    setCliente: vi.fn(),
  }),
  useInteracoes: () => ({
    interacoes: [],
    loading: false,
    carregar: vi.fn().mockResolvedValue(undefined),
    registrar: vi.fn(),
    editar: vi.fn(),
    apagar: vi.fn(),
  }),
  // O select de cliente do VendaForm lê daqui.
  useClientes: () => ({
    clientes: [
      { id: "cli-1", nome: "Padaria da Maria" },
      { id: "cli-2", nome: "Bruno" },
    ],
    loading: false,
    carregar: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/hooks/useModulos", () => ({
  useModulos: () => ({ moduloAtivo: () => true, modulos: {} }),
}));

/** O seletor real busca na API; aqui basta um botão que escolhe o produto. */
vi.mock("@/components/estoque/ProdutoSelect", () => ({
  ProdutoSelect: ({ onChange }: { onChange: (p: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onChange({
          id: "prod-bolo",
          nome: "Bolo de festa",
          preco_venda: "450.00",
          estoque_atual: "10",
          unidade: "unidade",
        })
      }
    >
      escolher Bolo
    </button>
  ),
}));

import ClienteDetalhePage from "./page";

function vendaCriada(extra: Partial<Venda> = {}): Venda {
  return {
    id: "v-nova",
    cliente: "cli-1",
    cliente_nome: "Padaria da Maria",
    data_venda: "2026-10-15",
    subtotal: "450.00",
    desconto: "0",
    total: "450.00",
    forma_pagamento: "pix",
    status_pagamento: "pago",
    data_prevista_pagamento: null,
    observacoes: "",
    itens: [],
    ja_baixou_estoque: false,
    tem_itens_com_produto: false,
    tem_lancamento_financeiro: false,
    criado_em: "2026-10-15T10:00:00Z",
    atualizado_em: "2026-10-15T10:00:00Z",
    ...extra,
  } as Venda;
}

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ data: [] });
  post.mockReset();
  post.mockResolvedValue({ data: vendaCriada() });
  recarregarCliente.mockClear();
});

async function abrirAtalho() {
  render(<ClienteDetalhePage />);
  fireEvent.click(await screen.findByRole("button", { name: /Registrar venda/i }));
}

async function montarUmItem() {
  fireEvent.click(await screen.findByRole("button", { name: "escolher Bolo" }));
  fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
}

/** O botão de submit do formulário, não o atalho que o abriu. */
function enviar() {
  const botoes = screen.getAllByRole("button", { name: /Registrar venda/i });
  fireEvent.click(botoes[botoes.length - 1]);
}

describe("Atalho de venda no perfil do cliente", () => {
  it("abre o formulário de VENDA, não o de interação", async () => {
    await abrirAtalho();

    // O título é do VendaForm.
    expect(await screen.findByText("Nova venda")).toBeInTheDocument();
    // E o formulário antigo não está em cena.
    expect(screen.queryByText("Registrar Interação")).toBeNull();
    expect(screen.queryByText("Tipo de Interação *")).toBeNull();
  });

  it("abre com o cliente da tela já escolhido", async () => {
    await abrirAtalho();

    const select = (await screen.findByLabelText("Cliente")) as HTMLSelectElement;
    expect(select.value).toBe("cli-1");
  });

  it("deixa trocar o cliente — é atalho, não trava", async () => {
    // Quem abriu pelo perfil da Ana e percebeu que a venda é do Bruno não
    // precisa fechar tudo e começar de novo.
    await abrirAtalho();

    const select = (await screen.findByLabelText("Cliente")) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "cli-2" } });

    expect(select.value).toBe("cli-2");
  });

  it("o botão some quando o módulo está desligado", async () => {
    vi.resetModules();
    vi.doMock("@/hooks/useModulos", () => ({
      useModulos: () => ({ moduloAtivo: () => false, modulos: {} }),
    }));
    const { default: Page } = await import("./page");

    render(<Page />);

    expect(
      screen.queryByRole("button", { name: /Registrar venda/i })
    ).toBeNull();
    // A interação, que não depende de módulo, continua.
    expect(
      await screen.findByRole("button", { name: /Nova Interação/i })
    ).toBeInTheDocument();
    vi.doUnmock("@/hooks/useModulos");
  });
});

describe("O que o atalho grava", () => {
  it("manda a venda para /vendas/, com o cliente, e nunca para interações", async () => {
    await abrirAtalho();

    await montarUmItem();
    enviar();

    await waitFor(() => expect(post).toHaveBeenCalled());

    const [url, corpo] = post.mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toBe("/vendas/");
    expect(corpo.cliente).toBe("cli-1");
    // A guarda: nenhuma chamada foi para o caminho antigo.
    const paraInteracoes = post.mock.calls.filter(([u]) =>
      String(u).includes("/interacoes/")
    );
    expect(paraInteracoes).toEqual([]);
  });

  it("depois de gravar, as perguntas do pós-venda entram em cena", async () => {
    // O atalho não é um atalho pela metade: estoque e financeiro são
    // perguntados aqui como seriam na tela de Vendas.
    post.mockResolvedValue({
      data: vendaCriada({ tem_itens_com_produto: false }),
    });
    await abrirAtalho();

    await montarUmItem();
    enviar();

    expect(await screen.findByText("Lançar no financeiro?")).toBeInTheDocument();
  });
});
