/**
 * O formulário de evento — com foco no lembrete.
 *
 * O lembrete é o que faz a agenda procurar a pessoa. O que importa aqui é que
 * a antecedência escolhida chegue ao backend, e que quem não pediu lembrete
 * continue sem lembrete.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { EventoForm } from "./EventoForm";
import type { Evento } from "@/types/agenda";

// A busca de clientes do CRM não é o assunto deste teste.
vi.mock("@/hooks/useAgenda", () => ({
  buscarClientes: vi.fn().mockResolvedValue([]),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const onSalvar = vi.fn().mockResolvedValue(undefined);
const onFechar = vi.fn();

beforeEach(() => {
  onSalvar.mockClear();
  onFechar.mockClear();
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
