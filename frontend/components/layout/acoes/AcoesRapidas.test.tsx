/**
 * O atalho cria de verdade — pelo mesmo caminho da tela do módulo.
 *
 * Estes testes existem para provar o que o atalho promete e o que seria fácil
 * ele quebrar: que o formulário é o do módulo (não uma cópia), que o POST vai
 * para o mesmo endpoint, e que salvar não arrasta ninguém para outra tela.
 *
 * Por isso o que está trocado aqui é só a rede. Os formulários, os hooks e os
 * invólucros são os de verdade.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import type { ProdutoList } from "@/types/estoque";

const get = vi.fn();
const post = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    patch: vi.fn(),
    delete: (...a: unknown[]) => vi.fn()(...a),
  },
  getErrorMessage: (erro: unknown) =>
    erro instanceof Error ? erro.message : "Erro inesperado.",
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
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

// O formulário de venda lista clientes num select; o hook real faria rede.
vi.mock("@/hooks/useClientes", async (original) => {
  const real = await original<typeof import("@/hooks/useClientes")>();
  return { ...real, useClientes: () => ({ clientes: [], carregar: vi.fn() }) };
});

import { AcaoRapidaVenda } from "./AcaoRapidaVenda";
import { AcaoRapidaProjeto } from "./AcaoRapidaProjeto";

const onFechar = vi.fn();
const onIrParaTela = vi.fn();

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  onFechar.mockReset();
  onIrParaTela.mockReset();
  get.mockResolvedValue({ success: true, data: [], pagination: { count: 0 } });
});

describe("Registrar venda pelo atalho", () => {
  function montar() {
    render(<AcaoRapidaVenda onFechar={onFechar} onIrParaTela={onIrParaTela} />);
  }

  it("abre o formulário de venda do módulo — o mesmo, com itens e desconto", () => {
    montar();

    // Marcas do VendaForm de verdade: se isto virasse uma cópia simplificada,
    // estes sumiriam.
    expect(screen.getByTestId("venda-subtotal")).toBeInTheDocument();
    expect(screen.getByLabelText(/desconto/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Cliente")).toBeInTheDocument();
  });

  it("salva pelo mesmo endpoint de criar venda", async () => {
    post.mockResolvedValue({
      data: {
        id: "v-1",
        itens: [],
        total: "50.00",
        tem_itens_com_produto: false,
        tem_lancamento_financeiro: true,
        ja_baixou_estoque: false,
      },
    });
    montar();

    fireEvent.click(screen.getByRole("button", { name: /escolher camisa/i }));
    fireEvent.click(screen.getByRole("button", { name: /adicionar/i }));
    fireEvent.click(screen.getByRole("button", { name: /registrar venda/i }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/vendas/", expect.objectContaining({
        itens: expect.arrayContaining([
          expect.objectContaining({ produto: "prod-camisa" }),
        ]),
      }))
    );
  });

  it("depois de salvar, avisa e NÃO leva a pessoa para outra tela", async () => {
    post.mockResolvedValue({
      data: {
        id: "v-1",
        itens: [],
        total: "50.00",
        tem_itens_com_produto: false,
        tem_lancamento_financeiro: true,
        ja_baixou_estoque: false,
      },
    });
    montar();
    fireEvent.click(screen.getByRole("button", { name: /escolher camisa/i }));
    fireEvent.click(screen.getByRole("button", { name: /adicionar/i }));
    fireEvent.click(screen.getByRole("button", { name: /registrar venda/i }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(toastSuccess.mock.calls[0][0]).toBe("Venda registrada.");
    // O ponto do atalho: quem usou continua onde estava.
    expect(onIrParaTela).not.toHaveBeenCalled();
  });

  it("o toast oferece ir ver o que foi criado — oferece, não obriga", async () => {
    post.mockResolvedValue({
      data: {
        id: "v-1",
        itens: [],
        total: "50.00",
        tem_itens_com_produto: false,
        tem_lancamento_financeiro: true,
        ja_baixou_estoque: false,
      },
    });
    montar();
    fireEvent.click(screen.getByRole("button", { name: /escolher camisa/i }));
    fireEvent.click(screen.getByRole("button", { name: /adicionar/i }));
    fireEvent.click(screen.getByRole("button", { name: /registrar venda/i }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    const opcoes = toastSuccess.mock.calls[0][1];
    expect(opcoes.action.label).toBe("Ver");

    opcoes.action.onClick();
    expect(onIrParaTela).toHaveBeenCalledWith("/vendas");
  });

  it("oferece abrir a tela completa, e fecha o atalho ao ir", () => {
    montar();

    fireEvent.click(screen.getByRole("button", { name: /abrir a tela de vendas/i }));

    expect(onFechar).toHaveBeenCalled();
    expect(onIrParaTela).toHaveBeenCalledWith("/vendas");
  });

  it("erro do backend mantém o formulário aberto com o motivo real", async () => {
    post.mockRejectedValue(
      new Error("O desconto não pode ser maior que o subtotal da venda.")
    );
    montar();
    fireEvent.click(screen.getByRole("button", { name: /escolher camisa/i }));
    fireEvent.click(screen.getByRole("button", { name: /adicionar/i }));
    fireEvent.click(screen.getByRole("button", { name: /registrar venda/i }));

    expect(
      await screen.findByText("O desconto não pode ser maior que o subtotal da venda.")
    ).toBeInTheDocument();
    expect(onFechar).not.toHaveBeenCalled();
  });
});

describe("Registrar projeto pelo atalho", () => {
  it("abre o formulário de projeto do módulo", () => {
    render(<AcaoRapidaProjeto onFechar={onFechar} onIrParaTela={onIrParaTela} />);

    // Marcas do ProjetoForm de verdade: nome, descrição e a paleta de cores.
    expect(screen.getByPlaceholderText(/lançamento do produto/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/objetivo do projeto/i)).toBeInTheDocument();
  });

  it("salva pelo mesmo endpoint, avisa e não navega", async () => {
    post.mockResolvedValue({ success: true, data: { id: "p-1", nome: "Reforma" } });
    render(<AcaoRapidaProjeto onFechar={onFechar} onIrParaTela={onIrParaTela} />);

    fireEvent.change(screen.getByPlaceholderText(/lançamento do produto/i), {
      target: { value: "Reforma" },
    });
    fireEvent.click(screen.getByRole("button", { name: /criar projeto/i }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/projetos/", expect.objectContaining({
        nome: "Reforma",
      }))
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(onIrParaTela).not.toHaveBeenCalled();
    expect(onFechar).toHaveBeenCalled();
  });
});
