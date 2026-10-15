/**
 * O atalho flutuante pergunta pelo estoque e pelo financeiro.
 *
 * ESTE ARQUIVO EXISTE POR CAUSA DE UM TESTE VERDE QUE MENTIA.
 *
 * `AcoesRapidas.test.tsx` provava que o atalho grava a venda pelo endpoint
 * certo e nunca pelo caminho antigo — tudo verdade, e tudo insuficiente. Em
 * staging, registrar uma venda pelo botão flutuante gravava a venda e fechava
 * tudo: as perguntas de baixa de estoque e de lançamento no financeiro nunca
 * apareciam.
 *
 * A CAUSA: `VendaForm` chama `onClose()` depois de salvar, e `onFechar` do
 * atalho é o `setAcao(null)` do `BotaoAcaoRapida` — que DESMONTA o
 * `AcaoRapidaVenda` inteiro. A venda era criada, o estado do pós-venda era
 * escrito, e no mesmo commit o componente que o guardava saía de cena.
 *
 * POR QUE O TESTE ANTIGO NÃO VIU: ele monta `AcaoRapidaVenda` direto, com
 * `onFechar` sendo um `vi.fn()`. Um spy não desmonta nada. O teste tinha
 * substituído por um mock exatamente o mecanismo que quebrava.
 *
 * Por isso aqui quem é montado é o `BotaoAcaoRapida` de verdade, com o
 * `AcaoRapidaVenda` de verdade e o `VendaPosVendaFlow` de verdade. O que está
 * trocado é só a rede.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { BotaoAcaoRapida } from "../BotaoAcaoRapida";
import type { ProdutoList } from "@/types/estoque";
import type { Venda } from "@/types/vendas";

const { post, previaEstoque, baixarEstoque, lancarFinanceiro } = vi.hoisted(
  () => ({
    post: vi.fn(),
    previaEstoque: vi.fn(),
    baixarEstoque: vi.fn(),
    lancarFinanceiro: vi.fn(),
  })
);

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: (...a: unknown[]) => post(...a),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  getErrorMessage: (e: unknown) =>
    e instanceof Error ? e.message : "Erro inesperado.",
}));

// As integrações são rede; o encadeamento das perguntas é o que se mede.
vi.mock("@/hooks/useVendas", async () => {
  const real = await vi.importActual<typeof import("@/hooks/useVendas")>(
    "@/hooks/useVendas"
  );
  return {
    ...real,
    vendaIntegracoes: {
      previaEstoque: (...a: unknown[]) => previaEstoque(...a),
      baixarEstoque: (...a: unknown[]) => baixarEstoque(...a),
      lancarFinanceiro: (...a: unknown[]) => lancarFinanceiro(...a),
    },
  };
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/store/useAppStore", () => ({
  useAppStore: () => ({ gavetaAberta: false }),
}));
vi.mock("@/hooks/useModulos", () => ({
  useModulos: () => ({ moduloAtivo: () => true }),
}));
vi.mock("@/hooks/useClientes", () => ({
  useClientes: () => ({
    clientes: [{ id: "cli-1", nome: "Padaria da Maria" }],
    carregar: vi.fn().mockResolvedValue(undefined),
  }),
}));

const CAMISA = {
  id: "prod-camisa",
  nome: "Camisa",
  preco_venda: "50.00",
  estoque_atual: "10",
  unidade: "unidade",
} as unknown as ProdutoList;

vi.mock("@/components/estoque/ProdutoSelect", () => ({
  ProdutoSelect: ({ onChange }: { onChange: (p: ProdutoList) => void }) => (
    <button type="button" onClick={() => onChange(CAMISA)}>
      escolher Camisa
    </button>
  ),
}));

function venda(extra: Partial<Venda> = {}): Venda {
  return {
    id: "v-nova",
    cliente: null,
    cliente_nome: null,
    data_venda: "2026-10-15",
    subtotal: "50.00",
    desconto: "0",
    total: "50.00",
    forma_pagamento: "pix",
    status_pagamento: "pago",
    data_prevista_pagamento: null,
    observacoes: "",
    itens: [],
    ja_baixou_estoque: false,
    tem_itens_com_produto: true,
    tem_lancamento_financeiro: false,
    criado_em: "2026-10-15T10:00:00Z",
    atualizado_em: "2026-10-15T10:00:00Z",
    ...extra,
  } as Venda;
}

beforeEach(() => {
  post.mockReset();
  post.mockResolvedValue({ data: venda() });
  previaEstoque.mockReset();
  previaEstoque.mockResolvedValue({ itens: [], pode_baixar: true });
  baixarEstoque.mockReset();
  baixarEstoque.mockResolvedValue(
    venda({ ja_baixou_estoque: true, tem_lancamento_financeiro: false })
  );
  lancarFinanceiro.mockReset();
  lancarFinanceiro.mockResolvedValue(venda({ tem_lancamento_financeiro: true }));
});

/** Abre o atalho, monta uma venda de um item e envia. */
async function registrarPeloFlutuante() {
  render(<BotaoAcaoRapida />);
  fireEvent.click(screen.getByTestId("botao-acao-rapida"));
  fireEvent.click(screen.getByRole("menuitem", { name: "Registrar venda" }));

  fireEvent.click(await screen.findByRole("button", { name: /escolher camisa/i }));
  fireEvent.click(screen.getByRole("button", { name: /^Adicionar$/ }));
  fireEvent.click(screen.getByRole("button", { name: /^Registrar venda$/ }));

  await waitFor(() => expect(post).toHaveBeenCalledWith("/vendas/", expect.anything()));
}

describe("Depois de registrar pelo botão flutuante", () => {
  it("pergunta pela baixa de estoque — não fecha tudo e vai embora", async () => {
    await registrarPeloFlutuante();

    expect(await screen.findByText("Baixar do estoque?")).toBeInTheDocument();
  });

  it("baixa de verdade, e só então pergunta pelo financeiro", async () => {
    await registrarPeloFlutuante();
    fireEvent.click(
      await screen.findByRole("button", { name: /Sim, baixar do estoque/i })
    );

    await waitFor(() =>
      expect(baixarEstoque).toHaveBeenCalledWith("v-nova", false)
    );
    expect(await screen.findByText("Lançar no financeiro?")).toBeInTheDocument();
  });

  it("lança a receita de verdade", async () => {
    await registrarPeloFlutuante();
    fireEvent.click(
      await screen.findByRole("button", { name: /Sim, baixar do estoque/i })
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /Sim, registrar receita/i })
    );

    await waitFor(() => expect(lancarFinanceiro).toHaveBeenCalledWith("v-nova"));
  });

  it("venda sem produto pula o estoque e pergunta direto o financeiro", async () => {
    post.mockResolvedValue({ data: venda({ tem_itens_com_produto: false }) });
    await registrarPeloFlutuante();

    expect(await screen.findByText("Lançar no financeiro?")).toBeInTheDocument();
    expect(screen.queryByText("Baixar do estoque?")).toBeNull();
    expect(previaEstoque).not.toHaveBeenCalled();
  });

  it('"Agora não" nas duas perguntas encerra o atalho sem gravar nada a mais', async () => {
    await registrarPeloFlutuante();

    fireEvent.click(await screen.findByRole("button", { name: "Agora não" }));
    fireEvent.click(await screen.findByRole("button", { name: "Agora não" }));

    await waitFor(() =>
      expect(screen.queryByText("Lançar no financeiro?")).toBeNull()
    );
    expect(baixarEstoque).not.toHaveBeenCalled();
    expect(lancarFinanceiro).not.toHaveBeenCalled();
  });

  it("o X do formulário, ANTES de gravar, fecha o atalho normalmente", async () => {
    // A outra metade do `onClose` condicional: sem gravação, ele fecha mesmo.
    render(<BotaoAcaoRapida />);
    fireEvent.click(screen.getByTestId("botao-acao-rapida"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Registrar venda" }));
    expect(await screen.findByText("Nova venda")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    await waitFor(() => expect(screen.queryByText("Nova venda")).toBeNull());
    expect(post).not.toHaveBeenCalled();
  });
});
