/**
 * O histórico do cliente com as duas origens juntas.
 *
 * Até a fase 3A a `montarHistorico` existia, testada, e nunca tinha sido
 * ligada a uma tela — os testes dela passavam sobre a função pura enquanto, na
 * página, a venda simplesmente não aparecia. Aqui quem é montado é a página, e
 * o que está trocado é só a rede.
 *
 * O risco que estes testes guardam é o oposto do bug original: agora que a
 * tela lê duas fontes, a mesma compra migrada não pode aparecer duas vezes.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import type { InteracaoCliente } from "@/types/clientes";
import type { Venda } from "@/types/vendas";

const get = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    get: (...args: unknown[]) => get(...args),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  getErrorMessage: (erro: unknown) =>
    erro instanceof Error ? erro.message : "Erro inesperado.",
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
  valor_total_compras: "120.00",
  quantidade_compras: 1,
  ticket_medio: "120.00",
  dias_sem_compra: 3,
  ultima_compra: null,
  proximo_followup: null,
  followup_atrasado: false,
  cpf_cnpj: null,
  endereco: null,
  cep: null,
  criado_em: "2026-07-01T10:00:00Z",
  criado_por_nome: "Maria",
};

/** As interações que o backend devolve — ele já esconde as migradas. */
let interacoesDoBackend: InteracaoCliente[] = [];

vi.mock("@/hooks/useClientes", () => ({
  useClienteDetalhe: () => ({
    cliente,
    loading: false,
    carregar: vi.fn(),
    setCliente: vi.fn(),
  }),
  useInteracoes: () => ({
    interacoes: interacoesDoBackend,
    loading: false,
    carregar: vi.fn(),
    registrar: vi.fn(),
    editar: vi.fn(),
    apagar: vi.fn(),
  }),
}));

import ClienteDetalhePage from "./page";

function ligacao(): InteracaoCliente {
  return {
    id: "int-1",
    tipo: "ligacao",
    tipo_display: "Ligação",
    titulo: "Liguei para a Maria",
    descricao: "",
    valor: null,
    data_interacao: "2026-07-25T14:30:00Z",
    proximo_followup: null,
    status_pagamento: "nao_se_aplica",
    status_pagamento_display: "Não se aplica",
    data_prevista_pagamento: null,
    pagamento_atrasado: false,
    dias_para_vencer: null,
    criado_por_nome: "Maria",
    criado_em: "2026-07-25T14:30:00Z",
  };
}

function venda(extra: Partial<Venda> = {}): Venda {
  return {
    id: "v-1",
    cliente: "cli-1",
    cliente_nome: "Padaria da Maria",
    data_venda: "2026-07-20",
    subtotal: "120.00",
    desconto: "0",
    total: "120.00",
    forma_pagamento: "pix",
    status_pagamento: "pago",
    data_prevista_pagamento: null,
    observacoes: "",
    itens: [
      {
        id: "i-1",
        produto: "prod-camisa",
        produto_nome: "Camisa",
        produto_unidade: "unidade",
        descricao: "",
        quantidade: "2",
        preco_unitario: "60.00",
        subtotal: "120.00",
      },
    ],
    ja_baixou_estoque: false,
    tem_itens_com_produto: true,
    tem_lancamento_financeiro: false,
    criado_em: "2026-07-20T10:00:00Z",
    atualizado_em: "2026-07-20T10:00:00Z",
    ...extra,
  } as Venda;
}

/** A migração da fase 2 produz exatamente esta forma: item livre e lançamento. */
function vendaMigrada(): Venda {
  return venda({
    id: "v-migrada",
    itens: [
      {
        id: "i-livre",
        produto: null,
        produto_nome: "Venda antiga",
        produto_unidade: "",
        descricao: "Venda antiga",
        quantidade: "1",
        preco_unitario: "120.00",
        subtotal: "120.00",
      },
    ],
    tem_itens_com_produto: false,
    tem_lancamento_financeiro: true,
  });
}

function comVendas(vendas: Venda[]) {
  get.mockImplementation((url: string) => {
    if (url.startsWith("/vendas/")) return Promise.resolve({ data: vendas });
    return Promise.resolve({ data: [] });
  });
}

beforeEach(() => {
  get.mockReset();
  interacoesDoBackend = [];
  comVendas([]);
});

describe("A venda entra no histórico do cliente", () => {
  it("uma venda com cliente aparece na timeline dele", async () => {
    comVendas([venda()]);

    render(<ClienteDetalhePage />);

    expect(await screen.findByText("Venda")).toBeInTheDocument();
    expect(screen.getByText("Camisa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ver venda/i })).toBeInTheDocument();
  });

  it("busca as vendas do cliente, e não a lista inteira", async () => {
    comVendas([venda()]);

    render(<ClienteDetalhePage />);

    await screen.findByText("Venda");
    expect(get).toHaveBeenCalledWith("/vendas/?cliente_id=cli-1");
  });

  it("interação e venda convivem, da mais recente para a mais antiga", async () => {
    // A ligação é de 25/07; a venda, de 20/07.
    interacoesDoBackend = [ligacao()];
    comVendas([venda()]);

    render(<ClienteDetalhePage />);

    await screen.findByText("Venda");
    const titulos = screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent);
    expect(titulos).toEqual(["Liguei para a Maria", "1 item"]);
  });

  it("clicar em 'Ver venda' abre o detalhe dela", async () => {
    comVendas([venda()]);
    render(<ClienteDetalhePage />);

    fireEvent.click(await screen.findByRole("button", { name: /ver venda/i }));

    // O detalhe traz o subtotal, que a linha da timeline não mostra.
    expect(screen.getByText("Subtotal")).toBeInTheDocument();
  });
});

describe("GUARDA: a venda migrada não aparece duas vezes", () => {
  it("aparece uma vez só — como Venda", async () => {
    // O backend já tirou a interação original da lista (migrada_para_venda).
    // Ela existe no banco; simplesmente não vem para cá.
    interacoesDoBackend = [];
    comVendas([vendaMigrada()]);

    render(<ClienteDetalhePage />);

    await screen.findByText("Venda");
    // Uma linha, um rótulo de origem, um nome de item. Se a interação original
    // voltasse a ser listada, cada um destes viraria dois.
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(1);
    expect(screen.getAllByText("Venda")).toHaveLength(1);
    expect(screen.getAllByText("Venda antiga")).toHaveLength(1);
  });

  it("não promete devolver estoque que ela nunca baixou", async () => {
    comVendas([vendaMigrada()]);

    render(<ClienteDetalhePage />);

    await screen.findByText("Venda");
    expect(screen.queryByText("Não descontado")).not.toBeInTheDocument();
    expect(screen.queryByText("Estoque descontado")).not.toBeInTheDocument();
    // Mas diz que a receita já está contada.
    expect(screen.getByText("No financeiro")).toBeInTheDocument();
  });
});
