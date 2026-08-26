/**
 * Formulário de venda — montar a venda linha a linha.
 *
 * O que estes testes fixam é o que a pessoa precisa ver enquanto monta: o
 * total acompanhando cada mudança, o cliente podendo ficar de fora, e o
 * desconto impossível sendo barrado antes de virar requisição.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

import { VendaForm } from "./VendaForm";
import type { ProdutoList } from "@/types/estoque";

const CAMISA = {
  id: "prod-camisa",
  nome: "Camisa",
  preco_venda: "50.00",
  estoque_atual: "10",
  unidade: "unidade",
} as unknown as ProdutoList;

const BONE = {
  id: "prod-bone",
  nome: "Bone",
  preco_venda: "30.00",
  estoque_atual: "5",
  unidade: "unidade",
} as unknown as ProdutoList;

/**
 * O seletor real busca produto na API. Aqui ele vira uma lista de botões:
 * o que este teste exercita é o formulário, não a busca.
 */
vi.mock("@/components/estoque/ProdutoSelect", () => ({
  ProdutoSelect: ({
    onChange,
  }: {
    value: ProdutoList | null;
    onChange: (p: ProdutoList | null) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onChange(CAMISA)}>
        escolher Camisa
      </button>
      <button type="button" onClick={() => onChange(BONE)}>
        escolher Bone
      </button>
    </div>
  ),
}));

const carregarClientes = vi.fn();
vi.mock("@/hooks/useClientes", () => ({
  useClientes: () => ({
    clientes: [{ id: "cli-1", nome: "Maria Souza" }],
    carregar: carregarClientes,
  }),
}));

const onSubmit = vi.fn().mockResolvedValue(undefined);
const onClose = vi.fn();

beforeEach(() => {
  onSubmit.mockClear();
  onClose.mockClear();
});

/** Texto dos totais sem o espaço não-quebrável do Intl. */
function texto(testId: string): string {
  return (screen.getByTestId(testId).textContent ?? "").replace(/ /g, " ");
}

function adicionar(produto: "Camisa" | "Bone") {
  fireEvent.click(screen.getByRole("button", { name: `escolher ${produto}` }));
  fireEvent.click(screen.getByRole("button", { name: /adicionar/i }));
}

function montar() {
  render(<VendaForm onSubmit={onSubmit} onClose={onClose} />);
}

describe("Itens da venda", () => {
  it("começa sem itens e avisa o que fazer", () => {
    montar();
    expect(screen.getByText(/nenhum item ainda/i)).toBeInTheDocument();
    expect(screen.queryAllByTestId("item-venda")).toHaveLength(0);
  });

  it("adiciona um item com o preço do cadastro", () => {
    montar();
    adicionar("Camisa");

    expect(screen.getAllByTestId("item-venda")).toHaveLength(1);
    expect(screen.getByDisplayValue("50.00")).toBeInTheDocument();
    expect(texto("venda-total")).toBe("R$ 50,00");
  });

  it("adiciona vários itens e soma", () => {
    montar();
    adicionar("Camisa");
    adicionar("Bone");

    expect(screen.getAllByTestId("item-venda")).toHaveLength(2);
    expect(texto("venda-subtotal")).toBe("R$ 80,00");
  });

  it("remove um item e o total acompanha", () => {
    montar();
    adicionar("Camisa");
    adicionar("Bone");
    expect(texto("venda-total")).toBe("R$ 80,00");

    fireEvent.click(screen.getByRole("button", { name: /remover bone/i }));

    expect(screen.getAllByTestId("item-venda")).toHaveLength(1);
    expect(texto("venda-total")).toBe("R$ 50,00");
  });
});

describe("Cálculo ao vivo", () => {
  it("mudar a quantidade recalcula", () => {
    montar();
    adicionar("Camisa");

    const linha = screen.getByTestId("item-venda");
    fireEvent.change(within(linha).getByLabelText(/quantidade/i), {
      target: { value: "3" },
    });

    expect(texto("venda-total")).toBe("R$ 150,00");
  });

  it("editar o preço do item recalcula", () => {
    montar();
    adicionar("Camisa");

    const linha = screen.getByTestId("item-venda");
    fireEvent.change(within(linha).getByLabelText(/preço unitário/i), {
      target: { value: "45.00" },
    });

    expect(texto("venda-total")).toBe("R$ 45,00");
  });

  it("total = subtotal − desconto", () => {
    montar();
    adicionar("Camisa");
    adicionar("Bone");

    fireEvent.change(screen.getByLabelText(/desconto/i), { target: { value: "10" } });

    expect(texto("venda-subtotal")).toBe("R$ 80,00");
    expect(texto("venda-total")).toBe("R$ 70,00");
  });
});

describe("Desconto impossível", () => {
  it("avisa e impede o envio", () => {
    montar();
    adicionar("Camisa");

    fireEvent.change(screen.getByLabelText(/desconto/i), { target: { value: "80" } });

    expect(screen.getByText(/não pode ser maior que o subtotal/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /registrar venda/i })).toBeDisabled();
  });
});

describe("Cliente é opcional", () => {
  it("a opção 'Sem cliente' existe e é a inicial", () => {
    montar();
    const select = screen.getByLabelText("Cliente") as HTMLSelectElement;

    expect(within(select).getByText("Sem cliente")).toBeInTheDocument();
    expect(select.value).toBe("");
  });

  it("envia cliente nulo quando não se escolhe ninguém", async () => {
    montar();
    adicionar("Camisa");
    fireEvent.click(screen.getByRole("button", { name: /registrar venda/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].cliente).toBeNull();
  });

  it("envia o cliente escolhido", async () => {
    montar();
    adicionar("Camisa");
    fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "cli-1" } });
    fireEvent.click(screen.getByRole("button", { name: /registrar venda/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].cliente).toBe("cli-1");
  });
});

describe("Envio", () => {
  it("não deixa registrar venda sem item", () => {
    montar();
    expect(screen.getByRole("button", { name: /registrar venda/i })).toBeDisabled();
  });

  it("manda os itens, e não manda totais — quem calcula é o backend", async () => {
    montar();
    adicionar("Camisa");
    adicionar("Bone");
    fireEvent.click(screen.getByRole("button", { name: /registrar venda/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    const enviado = onSubmit.mock.calls[0][0];

    expect(enviado.itens).toHaveLength(2);
    expect(enviado.itens[0]).toMatchObject({ produto: "prod-camisa", quantidade: "1" });
    expect(enviado).not.toHaveProperty("subtotal");
    expect(enviado).not.toHaveProperty("total");
  });

  it("mostra o motivo real quando o backend recusa", async () => {
    onSubmit.mockRejectedValueOnce(
      new Error("O desconto não pode ser maior que o subtotal da venda.")
    );
    montar();
    adicionar("Camisa");
    fireEvent.click(screen.getByRole("button", { name: /registrar venda/i }));

    expect(
      await screen.findByText("O desconto não pode ser maior que o subtotal da venda.")
    ).toBeInTheDocument();
  });
});
