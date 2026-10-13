/**
 * Os seletores de projeto e venda no formulário de evento (Fase B, item 7).
 *
 * O que importa aqui:
 *
 * 1. O DEBOUNCE. O seletor de cliente nasceu com um debounce escrito pela
 *    metade — o timer era declarado e limpo, mas nada o atribuía, e cada tecla
 *    ia ao servidor. Os dois seletores novos usam o mesmo hook, e estes testes
 *    existem para que o defeito não reapareça em nenhum dos três.
 * 2. Os seletores SOMEM com o módulo desligado.
 * 3. A sugestão de herdar o cliente da venda é oferta, não imposição.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

import { EventoForm } from "./EventoForm";
import { ESPERA_BUSCA_MS } from "@/hooks/useBuscaVinculo";
import type { Evento } from "@/types/agenda";
import type { OpcaoVinculo } from "@/hooks/useBuscaVinculo";

const buscarClientes = vi.fn().mockResolvedValue([]);
const buscarProjetos = vi.fn();
const buscarVendas = vi.fn();
vi.mock("@/hooks/useAgenda", () => ({
  buscarClientes: (...a: unknown[]) => buscarClientes(...a),
  buscarProjetos: (...a: unknown[]) => buscarProjetos(...a),
  buscarVendas: (...a: unknown[]) => buscarVendas(...a),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("@/hooks/useCategoriasAgenda", () => ({
  useCategoriasAgenda: () => ({
    categorias: [],
    loading: false,
    error: null,
    carregar: vi.fn().mockResolvedValue(undefined),
    criar: vi.fn(),
    atualizar: vi.fn(),
    definirAtivo: vi.fn(),
  }),
}));

/** Módulos ligados nesta renderização. */
let modulos: Record<string, boolean> = { projetos: true, estoque: true, agenda: true };
vi.mock("@/hooks/useModulos", () => ({
  useModulos: () => ({ moduloAtivo: (m: string) => modulos[m] ?? true }),
}));

const PROJETOS: OpcaoVinculo[] = [
  { id: "p1", rotulo: "Casamento Ana e João" },
  { id: "p2", rotulo: "Reforma da loja" },
];

const VENDAS: OpcaoVinculo[] = [
  {
    id: "v1",
    rotulo: "05/10/2026 · Ana Paula · R$ 150,00",
    clienteSugerido: { id: "c9", nome: "Ana Paula" },
  },
  { id: "v2", rotulo: "06/10/2026 · R$ 80,00", clienteSugerido: null },
];

const onSalvar = vi.fn().mockResolvedValue(undefined);
const onFechar = vi.fn();

function evento(over: Partial<Evento> = {}): Evento {
  return {
    id: "e1", titulo: "Reunião", descricao: "",
    data_inicio: "2026-10-05T14:00:00.000Z",
    data_fim: "2026-10-05T15:00:00.000Z",
    dia_inteiro: false, local: "", cor: "#6D28D9", cor_efetiva: "#6D28D9",
    categoria: null, categoria_nome: null,
    projeto: null, projeto_nome: null, venda: null, venda_rotulo: null,
    lembrete_antecedencia: 0,
    cliente: null, cliente_nome: null, criado_por: null, criado_por_nome: null,
    criado_em: "", atualizado_em: "",
    ...over,
  };
}

beforeEach(() => {
  modulos = { projetos: true, estoque: true, agenda: true };
  buscarClientes.mockClear().mockResolvedValue([]);
  buscarProjetos.mockClear().mockResolvedValue(PROJETOS);
  buscarVendas.mockClear().mockResolvedValue(VENDAS);
  onSalvar.mockClear();
  onFechar.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

const seletorProjeto = () => screen.getByLabelText("Projeto (opcional)") as HTMLSelectElement;
const seletorVenda = () => screen.getByLabelText("Venda (opcional)") as HTMLSelectElement;

function payloadSalvo() {
  return onSalvar.mock.calls.at(-1)![0];
}

async function preencherESalvar() {
  fireEvent.change(screen.getByPlaceholderText(/casamento ana/i), {
    target: { value: "Reunião de entrega" },
  });
  fireEvent.click(screen.getByRole("button", { name: /criar evento/i }));
  await waitFor(() => expect(onSalvar).toHaveBeenCalled());
}

// ── Os seletores existem e vinculam ────────────────────────────────────────

describe("Seletores de projeto e venda", () => {
  it("os dois aparecem no formulário", async () => {
    render(<EventoForm evento={null} onSalvar={onSalvar} onFechar={onFechar} />);

    expect(await screen.findByLabelText("Projeto (opcional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Venda (opcional)")).toBeInTheDocument();
  });

  it("listam o que o servidor devolveu", async () => {
    render(<EventoForm evento={null} onSalvar={onSalvar} onFechar={onFechar} />);

    expect(
      await screen.findByRole("option", { name: "Casamento Ana e João" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "05/10/2026 · Ana Paula · R$ 150,00" })
    ).toBeInTheDocument();
  });

  it("o projeto escolhido vai no payload", async () => {
    render(<EventoForm evento={null} onSalvar={onSalvar} onFechar={onFechar} />);
    await screen.findByRole("option", { name: "Casamento Ana e João" });

    fireEvent.change(seletorProjeto(), { target: { value: "p1" } });
    await preencherESalvar();

    expect(payloadSalvo().projeto).toBe("p1");
  });

  it("a venda escolhida vai no payload", async () => {
    render(<EventoForm evento={null} onSalvar={onSalvar} onFechar={onFechar} />);
    await screen.findByRole("option", { name: /06\/10\/2026/ });

    fireEvent.change(seletorVenda(), { target: { value: "v2" } });
    await preencherESalvar();

    expect(payloadSalvo().venda).toBe("v2");
  });

  it("cliente, projeto e venda convivem no mesmo evento", async () => {
    buscarClientes.mockResolvedValue([{ id: "c1", nome: "Ana Paula" }]);
    render(<EventoForm evento={null} onSalvar={onSalvar} onFechar={onFechar} />);
    await screen.findByRole("option", { name: "Casamento Ana e João" });

    fireEvent.change(screen.getByLabelText(/^cliente/i), { target: { value: "c1" } });
    fireEvent.change(seletorProjeto(), { target: { value: "p1" } });
    fireEvent.change(seletorVenda(), { target: { value: "v1" } });
    await preencherESalvar();

    const payload = payloadSalvo();
    expect(payload.cliente).toBe("c1");
    expect(payload.projeto).toBe("p1");
    expect(payload.venda).toBe("v1");
  });

  it("sem escolher nada, manda null — não a string vazia", async () => {
    render(<EventoForm evento={null} onSalvar={onSalvar} onFechar={onFechar} />);
    await preencherESalvar();

    expect(payloadSalvo().projeto).toBeNull();
    expect(payloadSalvo().venda).toBeNull();
  });

  it("editar um evento já vinculado abre com o vínculo selecionado", async () => {
    render(
      <EventoForm
        evento={evento({
          projeto: "p1", projeto_nome: "Casamento Ana e João",
          venda: "v1", venda_rotulo: "Venda de 05/10/2026",
        })}
        onSalvar={onSalvar}
        onFechar={onFechar}
      />
    );

    await waitFor(() => expect(seletorProjeto().value).toBe("p1"));
    expect(seletorVenda().value).toBe("v1");
  });

  it("o vínculo atual aparece na lista mesmo fora do resultado da busca", async () => {
    // Sem isto, abrir um evento cujo projeto não está na primeira página
    // mostraria o seletor em branco — e salvar apagaria o vínculo calado.
    buscarProjetos.mockResolvedValue([{ id: "outro", rotulo: "Projeto qualquer" }]);

    render(
      <EventoForm
        evento={evento({ projeto: "p9", projeto_nome: "Projeto antigo" })}
        onSalvar={onSalvar}
        onFechar={onFechar}
      />
    );

    expect(
      await screen.findByRole("option", { name: "Projeto antigo" })
    ).toBeInTheDocument();
    expect(seletorProjeto().value).toBe("p9");
  });
});

// ── O debounce (o bug que não pode voltar) ─────────────────────────────────

describe("Busca com debounce nos seletores novos", () => {
  /** Só as buscas COM texto — a inicial, de lista vazia, não conta. */
  const comTexto = (mock: typeof buscarProjetos) =>
    mock.mock.calls.filter(([termo]) => termo);

  it("digitar 'Casamento' dispara UMA busca de projeto, não nove", async () => {
    vi.useFakeTimers();
    try {
      render(<EventoForm evento={null} onSalvar={onSalvar} onFechar={onFechar} />);
      const campo = screen.getByLabelText("Buscar projeto");

      for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
        fireEvent.change(campo, { target: { value: "Casamento".slice(0, n) } });
        vi.advanceTimersByTime(50); // digitação rápida, dentro da espera
      }
      await act(async () => {
        vi.advanceTimersByTime(ESPERA_BUSCA_MS);
      });

      expect(comTexto(buscarProjetos)).toHaveLength(1);
      expect(comTexto(buscarProjetos)[0][0]).toBe("Casamento");
    } finally {
      vi.useRealTimers();
    }
  });

  it("digitar na busca de venda também espera", async () => {
    vi.useFakeTimers();
    try {
      render(<EventoForm evento={null} onSalvar={onSalvar} onFechar={onFechar} />);
      const campo = screen.getByLabelText("Buscar venda");

      for (const n of [1, 2, 3, 4]) {
        fireEvent.change(campo, { target: { value: "Ana".slice(0, n) } });
        vi.advanceTimersByTime(50);
      }
      await act(async () => {
        vi.advanceTimersByTime(ESPERA_BUSCA_MS);
      });

      expect(comTexto(buscarVendas)).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("antes de a espera acabar, o servidor não foi chamado com o texto", async () => {
    vi.useFakeTimers();
    try {
      render(<EventoForm evento={null} onSalvar={onSalvar} onFechar={onFechar} />);
      fireEvent.change(screen.getByLabelText("Buscar projeto"), {
        target: { value: "Cas" },
      });
      await act(async () => {
        vi.advanceTimersByTime(ESPERA_BUSCA_MS - 50);
      });

      expect(comTexto(buscarProjetos)).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ── Gating de módulo ───────────────────────────────────────────────────────

describe("Módulo desligado esconde o seletor", () => {
  it("sem Projetos, não há seletor de projeto", async () => {
    modulos = { projetos: false, estoque: true, agenda: true };
    render(<EventoForm evento={null} onSalvar={onSalvar} onFechar={onFechar} />);

    await screen.findByLabelText("Venda (opcional)");
    expect(screen.queryByLabelText("Projeto (opcional)")).not.toBeInTheDocument();
  });

  it("sem Projetos, nem sequer busca projetos no servidor", async () => {
    modulos = { projetos: false, estoque: true, agenda: true };
    render(<EventoForm evento={null} onSalvar={onSalvar} onFechar={onFechar} />);

    await screen.findByLabelText("Venda (opcional)");
    expect(buscarProjetos).not.toHaveBeenCalled();
  });

  it("sem Estoque, não há seletor de venda (é o critério que a Sidebar usa)", async () => {
    modulos = { projetos: true, estoque: false, agenda: true };
    render(<EventoForm evento={null} onSalvar={onSalvar} onFechar={onFechar} />);

    await screen.findByLabelText("Projeto (opcional)");
    expect(screen.queryByLabelText("Venda (opcional)")).not.toBeInTheDocument();
  });

  it("com os dois desligados, o formulário continua criando evento", async () => {
    modulos = { projetos: false, estoque: false, agenda: true };
    render(<EventoForm evento={null} onSalvar={onSalvar} onFechar={onFechar} />);

    await preencherESalvar();

    expect(payloadSalvo().titulo).toBe("Reunião de entrega");
  });
});

// ── A sugestão de herdar o cliente da venda ────────────────────────────────

describe("Herdar o cliente da venda", () => {
  const sugestao = () => screen.queryByTestId("sugestao-cliente-da-venda");

  it("escolher uma venda com cliente oferece vincular o evento a ele", async () => {
    render(<EventoForm evento={null} onSalvar={onSalvar} onFechar={onFechar} />);
    await screen.findByRole("option", { name: /Ana Paula/ });

    fireEvent.change(seletorVenda(), { target: { value: "v1" } });

    expect(sugestao()).toBeInTheDocument();
    expect(screen.getByText(/essa venda é de/i)).toBeInTheDocument();
  });

  it("aceitar a sugestão põe o cliente no payload", async () => {
    render(<EventoForm evento={null} onSalvar={onSalvar} onFechar={onFechar} />);
    await screen.findByRole("option", { name: /Ana Paula/ });

    fireEvent.change(seletorVenda(), { target: { value: "v1" } });
    fireEvent.click(screen.getByRole("button", { name: "Vincular" }));
    await preencherESalvar();

    expect(payloadSalvo().cliente).toBe("c9");
    expect(payloadSalvo().venda).toBe("v1");
  });

  it("é SUGESTÃO: ignorar salva a venda sem o cliente", async () => {
    // Quem quer o compromisso da venda sem marcar o cliente pode ter motivo —
    // o sistema facilita a coerência, não a impõe.
    render(<EventoForm evento={null} onSalvar={onSalvar} onFechar={onFechar} />);
    await screen.findByRole("option", { name: /Ana Paula/ });

    fireEvent.change(seletorVenda(), { target: { value: "v1" } });
    await preencherESalvar();

    expect(payloadSalvo().venda).toBe("v1");
    expect(payloadSalvo().cliente).toBeNull();
  });

  it("venda de balcão (sem cliente) não sugere nada", async () => {
    render(<EventoForm evento={null} onSalvar={onSalvar} onFechar={onFechar} />);
    await screen.findByRole("option", { name: /06\/10\/2026/ });

    fireEvent.change(seletorVenda(), { target: { value: "v2" } });

    expect(sugestao()).not.toBeInTheDocument();
  });

  it("evento que JÁ tem cliente não é incomodado com a sugestão", async () => {
    buscarClientes.mockResolvedValue([{ id: "c1", nome: "Outro cliente" }]);
    render(<EventoForm evento={null} onSalvar={onSalvar} onFechar={onFechar} />);
    await screen.findByRole("option", { name: /Ana Paula/ });

    fireEvent.change(screen.getByLabelText(/^cliente/i), { target: { value: "c1" } });
    fireEvent.change(seletorVenda(), { target: { value: "v1" } });

    expect(sugestao()).not.toBeInTheDocument();
  });

  it("depois de aceitar, a sugestão sai da tela", async () => {
    render(<EventoForm evento={null} onSalvar={onSalvar} onFechar={onFechar} />);
    await screen.findByRole("option", { name: /Ana Paula/ });

    fireEvent.change(seletorVenda(), { target: { value: "v1" } });
    fireEvent.click(screen.getByRole("button", { name: "Vincular" }));

    expect(sugestao()).not.toBeInTheDocument();
  });

  it("trocar para uma venda sem cliente limpa a sugestão", async () => {
    render(<EventoForm evento={null} onSalvar={onSalvar} onFechar={onFechar} />);
    await screen.findByRole("option", { name: /Ana Paula/ });

    fireEvent.change(seletorVenda(), { target: { value: "v1" } });
    expect(sugestao()).toBeInTheDocument();

    fireEvent.change(seletorVenda(), { target: { value: "v2" } });
    expect(sugestao()).not.toBeInTheDocument();
  });
});
