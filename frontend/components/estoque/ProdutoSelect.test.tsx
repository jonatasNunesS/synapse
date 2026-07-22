/**
 * ProdutoSelect: busca filtra os produtos (dispara listar com o texto) e
 * selecionar um produto chama onChange.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProdutoSelect } from "./ProdutoSelect";
import type { ProdutoList } from "@/types/estoque";

const listar = vi.fn();
const produtos: ProdutoList[] = [
  {
    id: "p1", nome: "Camisa Branca", sku: "CAM-1", categoria_nome: null,
    categoria_cor: null, preco_venda: 50, estoque_atual: 30, estoque_minimo: 5,
    status_estoque: "ok", unidade: "unidade", imagem_url: "", ativo: true,
  },
];

vi.mock("@/hooks/useEstoque", () => ({
  useProdutos: () => ({ produtos, loading: false, listar, paginacao: {}, error: null }),
}));

beforeEach(() => listar.mockClear());

describe("ProdutoSelect", () => {
  it("dispara a busca ao digitar (filtra por texto)", async () => {
    render(<ProdutoSelect value={null} onChange={vi.fn()} />);
    const input = screen.getByLabelText("Buscar produto");
    fireEvent.change(input, { target: { value: "camisa" } });
    await waitFor(() =>
      expect(listar).toHaveBeenCalledWith(expect.objectContaining({ busca: "camisa" }))
    );
  });

  it("lista os produtos e selecionar chama onChange", () => {
    const onChange = vi.fn();
    render(<ProdutoSelect value={null} onChange={onChange} />);
    fireEvent.click(screen.getByText("Camisa Branca"));
    expect(onChange).toHaveBeenCalledWith(produtos[0]);
  });

  it("com um produto selecionado, mostra o estoque atual", () => {
    render(<ProdutoSelect value={produtos[0]} onChange={vi.fn()} />);
    expect(screen.getByText(/Estoque atual: 30/)).toBeInTheDocument();
  });
});
