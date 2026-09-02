/**
 * O fluxo real de vender, do clique em "Nova venda" até o que acontece depois.
 *
 * Estes testes existem por causa do que os da fase 3A não pegaram. Lá o
 * componente das integrações era renderizado sozinho, com o hook de rede
 * inteiro trocado por mocks — ele respondia "me comporto bem quando montado",
 * e a pergunta que ninguém fez foi "eu sou montado?". A resposta era não, e o
 * bug passou verde.
 *
 * Aqui quem é montado é a página. O que está trocado é só a rede: a página, o
 * formulário, o hook e o encadeamento das perguntas são os de verdade.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import type { ProdutoList } from "@/types/estoque";
import type { Venda } from "@/types/vendas";

// ── A rede, e só ela ─────────────────────────────────────────────────────────
const get = vi.fn();
const post = vi.fn();
const del = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    patch: vi.fn(),
    delete: (...args: unknown[]) => del(...args),
  },
  getErrorMessage: (erro: unknown) =>
    erro instanceof Error ? erro.message : "Erro inesperado.",
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) },
}));

const CAMISA = {
  id: "prod-camisa",
  nome: "Camisa",
  preco_venda: "50.00",
  estoque_atual: "10",
  unidade: "unidade",
} as unknown as ProdutoList;

vi.mock("@/components/estoque/ProdutoSelect", () => ({
  ProdutoSelect: ({ onChange }: { onChange: (p: ProdutoList | null) => void }) => (
    <button type="button" onClick={() => onChange(CAMISA)}>
      escolher Camisa
    </button>
  ),
}));

vi.mock("@/hooks/useClientes", () => ({
  useClientes: () => ({ clientes: [], carregar: vi.fn() }),
}));

import VendasPage from "./page";

function venda(extra: Partial<Venda> = {}): Venda {
  return {
    id: "v-1",
    cliente: null,
    cliente_nome: null,
    data_venda: "2026-01-10",
    subtotal: "50.00",
    desconto: "0",
    total: "50.00",
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
        quantidade: "1",
        preco_unitario: "50.00",
        subtotal: "50.00",
      },
    ],
    ja_baixou_estoque: false,
    tem_itens_com_produto: true,
    tem_lancamento_financeiro: false,
    criado_em: "2026-01-10T10:00:00Z",
    atualizado_em: "2026-01-10T10:00:00Z",
    ...extra,
  } as Venda;
}

const PREVIA = {
  ja_baixou: false,
  tem_itens_com_produto: true,
  itens: [
    {
      item_id: "i-1",
      produto_id: "prod-camisa",
      produto_nome: "Camisa",
      quantidade: "1",
      estoque_antes: "10",
      estoque_depois: "9",
      suficiente: true,
    },
  ],
};

/** A lista da página e a prévia do estoque; o resto responde vazio. */
function respostasPadrao(lista: Venda[] = []) {
  get.mockImplementation((url: string) => {
    if (url.includes("/estoque/")) return Promise.resolve({ data: PREVIA });
    return Promise.resolve({ data: lista, pagination: { count: lista.length } });
  });
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  del.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  respostasPadrao();
});

/** Abre o formulário, põe uma Camisa e registra. */
async function registrarVenda(criada: Venda) {
  post.mockImplementation((url: string) => {
    if (url === "/vendas/") return Promise.resolve({ data: criada });
    return Promise.resolve({ data: criada });
  });

  render(<VendasPage />);
  fireEvent.click(await screen.findByRole("button", { name: /nova venda/i }));
  fireEvent.click(screen.getByRole("button", { name: /escolher camisa/i }));
  fireEvent.click(screen.getByRole("button", { name: /adicionar/i }));
  fireEvent.click(screen.getByRole("button", { name: /registrar venda/i }));
}

describe("Registrar uma venda faz a pergunta do estoque", () => {
  it("a pergunta aparece logo depois de salvar — não só no detalhe", async () => {
    await registrarVenda(venda());

    expect(await screen.findByTestId("pos-venda-estoque")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sim, baixar do estoque/i })
    ).toBeInTheDocument();
  });

  it("mostra o saldo antes e depois, e ver não baixa", async () => {
    await registrarVenda(venda());

    expect(await screen.findByTestId("pos-venda-previa")).toBeInTheDocument();
    expect(screen.getByText("10 → 9")).toBeInTheDocument();
    // Só existe o POST que criou a venda: ver a prévia não desconta nada.
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("confirmar baixa chama o endpoint da baixa", async () => {
    await registrarVenda(venda());
    await screen.findByTestId("pos-venda-estoque");

    post.mockResolvedValueOnce({ data: venda({ ja_baixou_estoque: true }) });
    fireEvent.click(screen.getByRole("button", { name: /sim, baixar do estoque/i }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/vendas/v-1/estoque/", { parcial: false })
    );
  });

  it("estoque insuficiente oferece baixar só o que tem", async () => {
    await registrarVenda(venda());
    await screen.findByTestId("pos-venda-estoque");

    post.mockRejectedValueOnce(new Error("Estoque insuficiente para um ou mais itens."));
    fireEvent.click(screen.getByRole("button", { name: /sim, baixar do estoque/i }));

    expect(
      await screen.findByText("Estoque insuficiente para um ou mais itens.")
    ).toBeInTheDocument();

    post.mockResolvedValueOnce({ data: venda({ ja_baixou_estoque: true }) });
    fireEvent.click(screen.getByRole("button", { name: /baixar só o que tem/i }));

    await waitFor(() =>
      expect(post).toHaveBeenLastCalledWith("/vendas/v-1/estoque/", { parcial: true })
    );
  });
});

describe("Depois do estoque vem a pergunta do financeiro", () => {
  it("responder o estoque leva à pergunta do caixa, com o valor", async () => {
    await registrarVenda(venda({ total: "1200.00" }));
    await screen.findByTestId("pos-venda-estoque");

    fireEvent.click(screen.getByRole("button", { name: /agora não/i }));

    const painel = await screen.findByTestId("pos-venda-financeiro");
    // O Intl separa "R$" do número com espaço não-quebrável.
    expect(painel.textContent?.replace(/\u00a0/g, " ")).toContain("R$ 1.200,00");
  });

  it("confirmar chama o endpoint do lançamento", async () => {
    await registrarVenda(venda());
    await screen.findByTestId("pos-venda-estoque");
    fireEvent.click(screen.getByRole("button", { name: /agora não/i }));
    await screen.findByTestId("pos-venda-financeiro");

    post.mockResolvedValueOnce({ data: venda({ tem_lancamento_financeiro: true }) });
    fireEvent.click(screen.getByRole("button", { name: /sim, registrar receita/i }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/vendas/v-1/financeiro/", {})
    );
  });

  it("dizer não às duas fecha sem fazer nada", async () => {
    await registrarVenda(venda());
    await screen.findByTestId("pos-venda-estoque");

    fireEvent.click(screen.getByRole("button", { name: /agora não/i }));
    fireEvent.click(await screen.findByRole("button", { name: /agora não/i }));

    await waitFor(() =>
      expect(screen.queryByTestId("pos-venda-financeiro")).not.toBeInTheDocument()
    );
    expect(post).toHaveBeenCalledTimes(1); // só o POST que criou a venda
  });
});

describe("GUARDA: o que a venda não tem não é perguntado", () => {
  it("venda só de item livre não vê a pergunta do estoque", async () => {
    // É a forma das 22 vendas migradas na fase 2: nenhum item com produto.
    await registrarVenda(venda({ tem_itens_com_produto: false }));

    expect(await screen.findByTestId("pos-venda-financeiro")).toBeInTheDocument();
    expect(screen.queryByTestId("pos-venda-estoque")).not.toBeInTheDocument();
    // Nem a prévia foi pedida: não há o que descontar.
    expect(get).not.toHaveBeenCalledWith(expect.stringContaining("/estoque/"));
  });

  it("venda que já tem lançamento não vê a pergunta do financeiro", async () => {
    await registrarVenda(venda({ tem_lancamento_financeiro: true }));
    await screen.findByTestId("pos-venda-estoque");

    fireEvent.click(screen.getByRole("button", { name: /agora não/i }));

    await waitFor(() =>
      expect(screen.queryByTestId("pos-venda-financeiro")).not.toBeInTheDocument()
    );
  });

  it("venda migrada não vê nenhuma das duas perguntas", async () => {
    await registrarVenda(
      venda({ tem_itens_com_produto: false, tem_lancamento_financeiro: true })
    );

    await waitFor(() => expect(post).toHaveBeenCalledWith("/vendas/", expect.any(Object)));
    expect(screen.queryByTestId("pos-venda-estoque")).not.toBeInTheDocument();
    expect(screen.queryByTestId("pos-venda-financeiro")).not.toBeInTheDocument();
  });
});

describe("Apagar a venda pergunta antes de desfazer", () => {
  /** Renderiza a lista já com uma venda e abre a exclusão dela. */
  async function abrirExclusao(alvo: Venda) {
    respostasPadrao([alvo]);
    render(<VendasPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Excluir venda" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
  }

  it("venda que baixou e lançou pergunta as duas coisas, e apaga com as escolhas", async () => {
    del.mockResolvedValue({});
    await abrirExclusao(
      venda({ ja_baixou_estoque: true, tem_lancamento_financeiro: true })
    );

    expect(await screen.findByText("Devolver ao estoque?")).toBeInTheDocument();
    expect(del).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /sim, devolver ao estoque/i }));

    expect(await screen.findByText("Apagar lançamento financeiro?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /sim, apagar lançamento/i }));

    await waitFor(() =>
      expect(del).toHaveBeenCalledWith(
        "/vendas/v-1/?estornar_estoque=true&apagar_financeiro=true"
      )
    );
  });

  it("dizer não às duas apaga só a venda", async () => {
    del.mockResolvedValue({});
    await abrirExclusao(
      venda({ ja_baixou_estoque: true, tem_lancamento_financeiro: true })
    );

    fireEvent.click(await screen.findByRole("button", { name: /não, manter/i }));
    fireEvent.click(await screen.findByRole("button", { name: /não, manter/i }));

    await waitFor(() => expect(del).toHaveBeenCalledWith("/vendas/v-1/"));
  });

  it("venda sem vínculo apaga direto, sem perguntas", async () => {
    del.mockResolvedValue({});
    await abrirExclusao(venda());

    await waitFor(() => expect(del).toHaveBeenCalledWith("/vendas/v-1/"));
    expect(screen.queryByText("Devolver ao estoque?")).not.toBeInTheDocument();
  });

  it("venda migrada só pergunta do financeiro — não baixou estoque nenhum", async () => {
    del.mockResolvedValue({});
    await abrirExclusao(
      venda({
        ja_baixou_estoque: false,
        tem_itens_com_produto: false,
        tem_lancamento_financeiro: true,
      })
    );

    expect(await screen.findByText("Apagar lançamento financeiro?")).toBeInTheDocument();
    expect(screen.queryByText("Devolver ao estoque?")).not.toBeInTheDocument();
  });
});
