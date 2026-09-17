/**
 * O formulário de evento — com foco no lembrete.
 *
 * O lembrete é o que faz a agenda procurar a pessoa. O que importa aqui é que
 * a antecedência escolhida chegue ao backend, e que quem não pediu lembrete
 * continue sem lembrete.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { ESPERA_BUSCA_MS, EventoForm, juntarComHora, soData } from "./EventoForm";
import type { Evento } from "@/types/agenda";

const buscarClientes = vi.fn().mockResolvedValue([]);
vi.mock("@/hooks/useAgenda", () => ({
  buscarClientes: (...args: unknown[]) => buscarClientes(...args),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const onSalvar = vi.fn().mockResolvedValue(undefined);
const onFechar = vi.fn();

beforeEach(() => {
  onSalvar.mockClear();
  onFechar.mockClear();
  buscarClientes.mockClear();
});

function abrirNovo() {
  render(<EventoForm evento={null} onSalvar={onSalvar} onFechar={onFechar} />);
}

/** O que foi enviado ao backend na última chamada. */
function payloadSalvo() {
  return onSalvar.mock.calls.at(-1)![0];
}

async function preencherESalvar() {
  fireEvent.change(screen.getByPlaceholderText(/casamento ana/i), {
    target: { value: "Reunião" },
  });
  fireEvent.click(screen.getByRole("button", { name: /criar evento/i }));
  await waitFor(() => expect(onSalvar).toHaveBeenCalled());
}

describe("Busca de cliente: uma chamada por busca, não uma por tecla", () => {
  const campo = () => screen.getByPlaceholderText(/buscar cliente/i);

  /** Só as buscas com texto — a inicial, de lista vazia, não conta. */
  const buscasComTexto = () =>
    buscarClientes.mock.calls.filter(([termo]) => termo);

  it("digitar 'Fernanda' dispara UMA busca, não oito", async () => {
    vi.useFakeTimers();
    try {
      abrirNovo();
      for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
        fireEvent.change(campo(), { target: { value: "Fernanda".slice(0, n) } });
        vi.advanceTimersByTime(50); // digitação rápida, dentro da espera
      }
      expect(buscasComTexto()).toHaveLength(0);

      vi.advanceTimersByTime(ESPERA_BUSCA_MS);
    } finally {
      vi.useRealTimers();
    }

    await waitFor(() => expect(buscasComTexto()).toHaveLength(1));
    expect(buscasComTexto()[0][0]).toBe("Fernanda");
  });

  it("parar e voltar a digitar busca de novo, com o termo novo", async () => {
    vi.useFakeTimers();
    try {
      abrirNovo();
      fireEvent.change(campo(), { target: { value: "Fer" } });
      vi.advanceTimersByTime(ESPERA_BUSCA_MS);
      fireEvent.change(campo(), { target: { value: "Maria" } });
      vi.advanceTimersByTime(ESPERA_BUSCA_MS);
    } finally {
      vi.useRealTimers();
    }

    await waitFor(() => expect(buscasComTexto()).toHaveLength(2));
    expect(buscasComTexto().map(([t]) => t)).toEqual(["Fer", "Maria"]);
  });

  it("o que a pessoa digitou aparece no campo na hora", () => {
    // O debounce atrasa a BUSCA, nunca o texto: um campo que engasga ao
    // digitar seria pior que o defeito que estamos consertando.
    abrirNovo();

    fireEvent.change(campo(), { target: { value: "Fern" } });

    expect(campo()).toHaveValue("Fern");
  });
});

describe("Dia inteiro", () => {
  const inicio = () => screen.getByLabelText(/início/i) as HTMLInputElement;
  const fim = () => screen.getByLabelText(/término/i) as HTMLInputElement;
  const caixaDiaInteiro = () => screen.getByLabelText(/dia inteiro/i);

  it("desmarcado, os campos pedem data E hora", () => {
    abrirNovo();

    expect(inicio().type).toBe("datetime-local");
    expect(fim().type).toBe("datetime-local");
  });

  it("marcado, a hora some da tela", () => {
    // Enquanto a hora ficava visível e editável, o campo mentia: dava para
    // gravar "dia inteiro das 14h às 15h" e a tela escondia a hora depois.
    abrirNovo();

    fireEvent.click(caixaDiaInteiro());

    expect(inicio().type).toBe("date");
    expect(fim().type).toBe("date");
    expect(inicio().value).not.toContain("T");
  });

  it("desmarcar devolve a hora", () => {
    abrirNovo();
    fireEvent.click(caixaDiaInteiro());

    fireEvent.click(caixaDiaInteiro());

    expect(inicio().type).toBe("datetime-local");
  });

  it("um dia só, com as horas escondidas invertidas, salva mesmo assim", async () => {
    // O cenário real: o formulário abriu às 23h30, então a hora guardada no
    // início é 23:30 e a do término, 00:30. Marcar dia inteiro esconde as
    // duas — e comparar por HORA recusaria um evento de um dia só por causa
    // de valores que ninguém escolheu e que a tela nem mostra.
    // O slot fixa o horário: sem ele o teste só pegaria o bug às 23h.
    const abertura = new Date("2026-11-20T23:30:00");
    render(
      <EventoForm
        evento={null}
        slotInicial={{
          inicio: abertura,
          fim: new Date("2026-11-20T00:30:00"),
        }}
        onSalvar={onSalvar}
        onFechar={onFechar}
      />
    );
    fireEvent.click(caixaDiaInteiro());

    fireEvent.change(inicio(), { target: { value: "2026-11-20" } });
    fireEvent.change(fim(), { target: { value: "2026-11-20" } });
    await preencherESalvar();

    // Quem normaliza para 00:00 → 23:59 é o backend; daqui sai o dia certo.
    expect(payloadSalvo().dia_inteiro).toBe(true);
    expect(payloadSalvo().data_inicio).toContain("2026-11-20");
  });

  it("término num dia ANTERIOR continua sendo recusado", async () => {
    // A guarda não pode sumir junto com a comparação por hora.
    render(
      <EventoForm
        evento={null}
        slotInicial={{
          inicio: new Date("2026-11-20T10:00:00"),
          fim: new Date("2026-11-18T10:00:00"),
        }}
        onSalvar={onSalvar}
        onFechar={onFechar}
      />
    );
    fireEvent.click(caixaDiaInteiro());

    fireEvent.change(screen.getByPlaceholderText(/casamento ana/i), {
      target: { value: "Viagem impossível" },
    });
    fireEvent.click(screen.getByRole("button", { name: /criar evento/i }));

    expect(
      await screen.findByText(/não pode ser anterior/i)
    ).toBeInTheDocument();
    expect(onSalvar).not.toHaveBeenCalled();
  });

  it("os ajudantes de data não perdem nem inventam hora", () => {
    expect(soData("2026-10-05T14:30")).toBe("2026-10-05");
    expect(juntarComHora("2026-11-20", "2026-10-05T14:30")).toBe("2026-11-20T14:30");
    // Sem hora anterior, meia-noite — não um valor quebrado.
    expect(juntarComHora("2026-11-20", "")).toBe("2026-11-20T00:00");
  });
});

describe("Lembrete", () => {
  it("nasce em 'Sem lembrete' — não se impõe aviso a quem não pediu", () => {
    abrirNovo();
    expect(screen.getByLabelText(/lembrete/i)).toHaveValue("0");
  });

  it("oferece as antecedências do backend", () => {
    abrirNovo();
    const rotulos = Array.from(
      screen.getByLabelText(/lembrete/i).querySelectorAll("option")
    ).map((o) => o.textContent);

    expect(rotulos).toEqual([
      "Sem lembrete",
      "10 minutos antes",
      "30 minutos antes",
      "1 hora antes",
      "1 dia antes",
    ]);
  });

  it("salva a antecedência escolhida", async () => {
    abrirNovo();
    fireEvent.change(screen.getByLabelText(/lembrete/i), { target: { value: "60" } });

    await preencherESalvar();

    expect(payloadSalvo().lembrete_antecedencia).toBe(60);
  });

  it("sem escolher nada, manda zero — e não undefined", async () => {
    // Mandar undefined faria o PATCH parcial cair no default do serializer, o
    // mesmo tipo de armadilha que já zerou desconto de venda uma vez.
    abrirNovo();

    await preencherESalvar();

    expect(payloadSalvo().lembrete_antecedencia).toBe(0);
  });

  it("editando, abre com a antecedência que o evento já tinha", () => {
    const evento = {
      id: "e1",
      titulo: "Consulta",
      descricao: "",
      data_inicio: new Date("2026-10-01T14:00:00Z").toISOString(),
      data_fim: new Date("2026-10-01T15:00:00Z").toISOString(),
      dia_inteiro: false,
      local: "",
      cor: "#6D28D9",
      lembrete_antecedencia: 1440,
      cliente: null,
      cliente_nome: null,
      criado_por: null,
      criado_por_nome: null,
      criado_em: "",
      atualizado_em: "",
    } satisfies Evento;

    render(<EventoForm evento={evento} onSalvar={onSalvar} onFechar={onFechar} />);

    expect(screen.getByLabelText(/lembrete/i)).toHaveValue("1440");
  });
});
