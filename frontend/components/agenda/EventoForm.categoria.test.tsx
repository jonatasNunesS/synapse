/**
 * O seletor de categoria no formulário de evento.
 *
 * Antes daqui havia dez cores mudas. O que importa agora: a categoria escolhida
 * chega ao backend, quem não escolhe manda `null` (e não "" ), e o evento
 * antigo abre mostrando a cor que já tinha em vez de mentir outra.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { EventoForm } from "./EventoForm";
import type { CategoriaEvento, Evento } from "@/types/agenda";

const buscarClientes = vi.fn().mockResolvedValue([]);
vi.mock("@/hooks/useAgenda", () => ({
  buscarClientes: (...args: unknown[]) => buscarClientes(...args),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

let categorias: CategoriaEvento[] = [];
let erroCategorias: string | null = null;
const carregarCategorias = vi.fn().mockResolvedValue(undefined);
vi.mock("@/hooks/useCategoriasAgenda", () => ({
  useCategoriasAgenda: () => ({
    categorias,
    loading: false,
    error: erroCategorias,
    carregar: carregarCategorias,
    criar: vi.fn(),
    atualizar: vi.fn(),
    definirAtivo: vi.fn(),
  }),
}));

const onSalvar = vi.fn().mockResolvedValue(undefined);
const onFechar = vi.fn();

function categoria(over: Partial<CategoriaEvento> = {}): CategoriaEvento {
  return {
    id: "c1",
    nome: "Cobrança",
    cor: "#F97316",
    ativo: true,
    ordem: 0,
    eventos_count: 0,
    criado_em: "",
    ...over,
  };
}

function evento(over: Partial<Evento> = {}): Evento {
  return {
    id: "e1",
    titulo: "Follow-up",
    descricao: "",
    data_inicio: "2026-10-05T14:00:00.000Z",
    data_fim: "2026-10-05T15:00:00.000Z",
    dia_inteiro: false,
    local: "",
    cor: "#3B82F6",
    cor_efetiva: "#3B82F6",
    categoria: null,
    categoria_nome: null,
    lembrete_antecedencia: 0,
    cliente: null,
    cliente_nome: null,
    criado_por: null,
    criado_por_nome: null,
    criado_em: "",
    atualizado_em: "",
    ...over,
  };
}

beforeEach(() => {
  categorias = [categoria(), categoria({ id: "c2", nome: "Visita", cor: "#22C55E" })];
  erroCategorias = null;
  onSalvar.mockClear();
  onFechar.mockClear();
  carregarCategorias.mockClear();
});

const seletor = () => screen.getByLabelText(/categoria/i) as HTMLSelectElement;

function payloadSalvo() {
  return onSalvar.mock.calls.at(-1)![0];
}

async function salvar(rotulo: RegExp) {
  fireEvent.click(screen.getByRole("button", { name: rotulo }));
  await waitFor(() => expect(onSalvar).toHaveBeenCalled());
}

describe("Escolher a categoria", () => {
  it("as categorias da empresa aparecem no seletor", () => {
    render(<EventoForm evento={null} onSalvar={onSalvar} onFechar={onFechar} />);

    expect(screen.getByRole("option", { name: "Cobrança" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Visita" })).toBeInTheDocument();
  });

  it("a categoria escolhida vai no payload", async () => {
    render(<EventoForm evento={null} onSalvar={onSalvar} onFechar={onFechar} />);
    fireEvent.change(screen.getByPlaceholderText(/casamento ana/i), {
      target: { value: "Ligar pro cliente" },
    });
    fireEvent.change(seletor(), { target: { value: "c1" } });

    await salvar(/criar evento/i);

    expect(payloadSalvo().categoria).toBe("c1");
  });

  it("sem escolher, manda null — não a string vazia, que o backend recusaria", async () => {
    render(<EventoForm evento={null} onSalvar={onSalvar} onFechar={onFechar} />);
    fireEvent.change(screen.getByPlaceholderText(/casamento ana/i), {
      target: { value: "Ligar pro cliente" },
    });

    await salvar(/criar evento/i);

    expect(payloadSalvo().categoria).toBeNull();
  });

  it("dá pra tirar a categoria de um evento que tinha uma", async () => {
    render(
      <EventoForm
        evento={evento({ categoria: "c1", categoria_nome: "Cobrança" })}
        onSalvar={onSalvar}
        onFechar={onFechar}
      />
    );
    expect(seletor().value).toBe("c1");

    fireEvent.change(seletor(), { target: { value: "" } });
    await salvar(/salvar/i);

    expect(payloadSalvo().categoria).toBeNull();
  });
});

describe("A prévia mostra a cor que o evento vai ter", () => {
  const previa = () => screen.getByTestId("previa-cor-categoria");

  it("escolher a categoria repinta a prévia com a cor DELA", () => {
    render(<EventoForm evento={null} onSalvar={onSalvar} onFechar={onFechar} />);

    fireEvent.change(seletor(), { target: { value: "c2" } });

    expect(previa()).toHaveStyle({ backgroundColor: "#22C55E" });
  });

  it("evento antigo sem categoria abre mostrando a cor que ele já tinha", () => {
    // O follow-up crava #3B82F6 desde antes das categorias. Abrir o formulário
    // não pode sugerir outra cor: seria a tela mentindo sobre o calendário.
    render(<EventoForm evento={evento()} onSalvar={onSalvar} onFechar={onFechar} />);

    expect(previa()).toHaveStyle({ backgroundColor: "#3B82F6" });
  });
});

describe("Quando não há categoria nenhuma", () => {
  it("o formulário continua utilizável e explica quem cria", async () => {
    categorias = [];
    render(<EventoForm evento={null} onSalvar={onSalvar} onFechar={onFechar} />);

    expect(screen.getByText(/nenhuma categoria ainda/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/casamento ana/i), {
      target: { value: "Ligar pro cliente" },
    });
    await salvar(/criar evento/i);

    expect(payloadSalvo().titulo).toBe("Ligar pro cliente");
  });

  it("se a lista falhou, não repete a dica de criar categoria", () => {
    categorias = [];
    erroCategorias = "Não foi possível carregar as categorias.";
    render(<EventoForm evento={null} onSalvar={onSalvar} onFechar={onFechar} />);

    expect(screen.queryByText(/nenhuma categoria ainda/i)).not.toBeInTheDocument();
  });
});
