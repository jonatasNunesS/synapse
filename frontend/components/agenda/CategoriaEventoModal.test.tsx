/**
 * Gestão de categorias (admin).
 *
 * O ponto delicado aqui é o que NÃO existe: excluir. Uma categoria explica a
 * cor de eventos já registrados; apagá-la apagaria a explicação do histórico.
 * Desligar some do formulário e preserva quem já a usa.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { CategoriaEventoModal } from "./CategoriaEventoModal";
import type { CategoriaEvento } from "@/types/agenda";

const toastErro = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastErro(...a), success: vi.fn() },
}));

let categorias: CategoriaEvento[] = [];
let incluirInativasPedido: boolean | undefined;
const carregar = vi.fn().mockResolvedValue(undefined);
const criar = vi.fn().mockResolvedValue(undefined);
const atualizar = vi.fn().mockResolvedValue(undefined);
const definirAtivo = vi.fn().mockResolvedValue(undefined);

vi.mock("@/hooks/useCategoriasAgenda", () => ({
  useCategoriasAgenda: (incluirInativas?: boolean) => {
    incluirInativasPedido = incluirInativas;
    return {
      categorias,
      loading: false,
      error: null,
      carregar,
      criar,
      atualizar,
      definirAtivo,
    };
  },
}));

function categoria(over: Partial<CategoriaEvento> = {}): CategoriaEvento {
  return {
    id: "c1",
    nome: "Cobrança",
    cor: "#F97316",
    ativo: true,
    ordem: 0,
    eventos_count: 3,
    criado_em: "",
    ...over,
  };
}

const onFechar = vi.fn();
const onMudou = vi.fn();

beforeEach(() => {
  categorias = [categoria()];
  incluirInativasPedido = undefined;
  [carregar, criar, atualizar, definirAtivo, onFechar, onMudou, toastErro].forEach((m) =>
    m.mockClear()
  );
  criar.mockResolvedValue(undefined);
  atualizar.mockResolvedValue(undefined);
  definirAtivo.mockResolvedValue(undefined);
});

function abrir() {
  render(<CategoriaEventoModal onFechar={onFechar} onMudou={onMudou} />);
}

describe("A lista da gestão", () => {
  it("pede também as desativadas — senão não haveria como religá-las", () => {
    abrir();

    expect(incluirInativasPedido).toBe(true);
  });

  it("mostra quantos eventos usam a categoria antes de mexer nela", () => {
    abrir();

    expect(screen.getByText("3 eventos")).toBeInTheDocument();
  });

  it("não existe botão de excluir categoria", () => {
    abrir();

    expect(screen.queryByRole("button", { name: /excluir/i })).not.toBeInTheDocument();
  });
});

describe("Criar categoria", () => {
  it("manda nome e cor escolhida", async () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: /nova categoria/i }));
    fireEvent.change(screen.getByLabelText(/nome/i), {
      target: { value: "Visita técnica" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cor #22c55e" }));
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));

    await waitFor(() =>
      expect(criar).toHaveBeenCalledWith({ nome: "Visita técnica", cor: "#22c55e" })
    );
  });

  it("criar avisa a tela da agenda, que precisa repintar e mostrar na legenda", async () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: /nova categoria/i }));
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: "Visita" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));

    await waitFor(() => expect(onMudou).toHaveBeenCalled());
  });

  it("nome repetido: o erro do backend fica na tela, não é engolido", async () => {
    // Formato que o `api` já entrega ao caller (ver `getErrorMessage`).
    criar.mockRejectedValue({
      error: { code: "NOME_DUPLICADO", message: "Já existe uma categoria com este nome." },
    });
    abrir();
    fireEvent.click(screen.getByRole("button", { name: /nova categoria/i }));
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: "Cobrança" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));

    expect(
      await screen.findByText(/já existe uma categoria com este nome/i)
    ).toBeInTheDocument();
    // E o formulário continua aberto, com o que foi digitado.
    expect(screen.getByLabelText(/nome/i)).toHaveValue("Cobrança");
  });
});

describe("Editar categoria", () => {
  it("abre preenchida e salva a mudança de cor", async () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: /editar cobrança/i }));

    expect(screen.getByLabelText(/nome/i)).toHaveValue("Cobrança");

    fireEvent.click(screen.getByRole("button", { name: "Cor #22c55e" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(atualizar).toHaveBeenCalledWith("c1", { nome: "Cobrança", cor: "#22c55e" })
    );
  });
});

describe("Desativar e reativar", () => {
  it("desativar chama o backend com ativo=false", async () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: /desativar cobrança/i }));

    await waitFor(() => expect(definirAtivo).toHaveBeenCalledWith("c1", false));
  });

  it("a desativada continua na lista, marcada, com o botão de religar", () => {
    categorias = [categoria({ ativo: false })];
    abrir();

    expect(screen.getByText(/desativada/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reativar cobrança/i })
    ).toBeInTheDocument();
  });

  it("reativar manda ativo=true", async () => {
    categorias = [categoria({ ativo: false })];
    abrir();
    fireEvent.click(screen.getByRole("button", { name: /reativar cobrança/i }));

    await waitFor(() => expect(definirAtivo).toHaveBeenCalledWith("c1", true));
  });

  it("falha ao desativar não fica calada", async () => {
    definirAtivo.mockRejectedValue(new Error("falhou"));
    abrir();
    fireEvent.click(screen.getByRole("button", { name: /desativar cobrança/i }));

    await waitFor(() => expect(toastErro).toHaveBeenCalled());
  });
});
