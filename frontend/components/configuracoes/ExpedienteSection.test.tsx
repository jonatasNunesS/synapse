/**
 * Configurações → Expediente.
 *
 * O que importa: só admin muda (é como a empresa trabalha, não preferência
 * individual), um expediente invertido não é salvo, e o que volta do servidor
 * entra no store — senão a grade da Agenda só mudaria no próximo load.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import {
  ExpedienteSection,
  rotuloDuracao,
  rotuloHora,
} from "./ExpedienteSection";
import { useAppStore } from "@/store/useAppStore";
import type { Usuario } from "@/types/auth";

const patch = vi.fn();
vi.mock("@/lib/api", async () => {
  const real = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...real,
    api: { patch: (...a: unknown[]) => patch(...a) },
  };
});

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...a: unknown[]) => toastError(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
  },
}));

function entrar(
  perfil: "admin" | "membro",
  inicio = 7,
  fim = 20,
  duracao = 60
) {
  useAppStore.setState({
    usuario: {
      id: "u1",
      perfil,
      empresa: {
        id: "e1",
        agenda_hora_inicio: inicio,
        agenda_hora_fim: fim,
        agenda_duracao_padrao: duracao,
      },
    } as unknown as Usuario,
  });
}

const campoInicio = () => screen.getByLabelText(/começa às/i) as HTMLSelectElement;
const campoFim = () => screen.getByLabelText(/termina às/i) as HTMLSelectElement;
const campoDuracao = () =>
  screen.getByLabelText(/evento novo dura/i) as HTMLSelectElement;
const botaoSalvar = () => screen.getByRole("button", { name: /salvar/i });

beforeEach(() => {
  patch.mockReset();
  toastError.mockClear();
  toastSuccess.mockClear();
  useAppStore.setState({ usuario: null });
});

describe("O que a seção mostra", () => {
  it("abre com o expediente que a empresa tem hoje", () => {
    entrar("admin", 9, 18);
    render(<ExpedienteSection />);

    expect(campoInicio()).toHaveValue("9");
    expect(campoFim()).toHaveValue("18");
  });

  it("deixa claro que nada fica escondido fora da faixa", () => {
    entrar("admin");
    render(<ExpedienteSection />);

    expect(
      screen.getByText(/nenhum compromisso fora dela é escondido/i)
    ).toBeInTheDocument();
  });

  it("o rótulo da hora é legível", () => {
    expect(rotuloHora(7)).toBe("07:00");
    expect(rotuloHora(0)).toBe("00:00");
    expect(rotuloHora(24)).toBe("24:00");
  });
});

describe("Só admin muda", () => {
  it("membro vê, mas com os controles travados", () => {
    entrar("membro");
    render(<ExpedienteSection />);

    expect(campoInicio()).toBeDisabled();
    expect(campoFim()).toBeDisabled();
    expect(botaoSalvar()).toBeDisabled();
    expect(
      screen.getByText(/apenas administradores podem alterar/i)
    ).toBeInTheDocument();
  });

  it("admin pode mexer", () => {
    entrar("admin");
    render(<ExpedienteSection />);

    expect(campoInicio()).toBeEnabled();
  });
});

describe("Salvar", () => {
  it("manda o expediente novo e guarda a resposta no store", async () => {
    entrar("admin");
    patch.mockResolvedValue({
      data: {
        agenda_hora_inicio: 9,
        agenda_hora_fim: 18,
        agenda_duracao_padrao: 30,
      },
    });
    render(<ExpedienteSection />);

    fireEvent.change(campoInicio(), { target: { value: "9" } });
    fireEvent.change(campoFim(), { target: { value: "18" } });
    fireEvent.change(campoDuracao(), { target: { value: "30" } });
    fireEvent.click(botaoSalvar());

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(patch).toHaveBeenCalledWith("/auth/empresa/agenda/", {
      agenda_hora_inicio: 9,
      agenda_hora_fim: 18,
      agenda_duracao_padrao: 30,
    });
    // Sem isto a grade da Agenda só mudaria no próximo load.
    await waitFor(() =>
      expect(useAppStore.getState().usuario?.empresa?.agenda_hora_inicio).toBe(9)
    );
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("sem mudar nada, não há o que salvar", () => {
    entrar("admin");
    render(<ExpedienteSection />);

    expect(botaoSalvar()).toBeDisabled();
  });

  it("erro do servidor aparece e o store não muda", async () => {
    entrar("admin");
    patch.mockRejectedValue(new Error("deu ruim"));
    render(<ExpedienteSection />);

    fireEvent.change(campoInicio(), { target: { value: "9" } });
    fireEvent.click(botaoSalvar());

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(useAppStore.getState().usuario?.empresa?.agenda_hora_inicio).toBe(7);
  });
});

describe("Expediente invertido", () => {
  it("não deixa salvar e diz o porquê", () => {
    entrar("admin");
    render(<ExpedienteSection />);

    fireEvent.change(campoInicio(), { target: { value: "20" } });
    fireEvent.change(campoFim(), { target: { value: "9" } });

    expect(
      screen.getByText(/precisa terminar depois de começar/i)
    ).toBeInTheDocument();
    expect(botaoSalvar()).toBeDisabled();
    expect(patch).not.toHaveBeenCalled();
  });

  it("começar e terminar na mesma hora também não vale", () => {
    entrar("admin");
    render(<ExpedienteSection />);

    fireEvent.change(campoInicio(), { target: { value: "9" } });
    fireEvent.change(campoFim(), { target: { value: "9" } });

    expect(botaoSalvar()).toBeDisabled();
  });

  it("corrigir a inversão libera o salvar de novo", () => {
    entrar("admin");
    render(<ExpedienteSection />);
    fireEvent.change(campoInicio(), { target: { value: "20" } });
    fireEvent.change(campoFim(), { target: { value: "9" } });

    fireEvent.change(campoFim(), { target: { value: "22" } });

    expect(botaoSalvar()).toBeEnabled();
    expect(
      screen.queryByText(/precisa terminar depois de começar/i)
    ).not.toBeInTheDocument();
  });
});

describe("Duração padrão do evento novo", () => {
  it("abre com a duração que a empresa tem hoje", () => {
    entrar("admin", 7, 20, 30);
    render(<ExpedienteSection />);

    expect(campoDuracao()).toHaveValue("30");
  });

  it("mudar só a duração já habilita o salvar", () => {
    // Sem isso, trocar a duração sem mexer no expediente não salvaria nada.
    entrar("admin");
    render(<ExpedienteSection />);

    fireEvent.change(campoDuracao(), { target: { value: "90" } });

    expect(botaoSalvar()).toBeEnabled();
  });

  it("membro vê, mas não muda", () => {
    entrar("membro");
    render(<ExpedienteSection />);

    expect(campoDuracao()).toBeDisabled();
  });

  it("guarda a duração da resposta no store", async () => {
    entrar("admin");
    patch.mockResolvedValue({
      data: {
        agenda_hora_inicio: 7,
        agenda_hora_fim: 20,
        agenda_duracao_padrao: 120,
      },
    });
    render(<ExpedienteSection />);

    fireEvent.change(campoDuracao(), { target: { value: "120" } });
    fireEvent.click(botaoSalvar());

    await waitFor(() =>
      expect(
        useAppStore.getState().usuario?.empresa?.agenda_duracao_padrao
      ).toBe(120)
    );
  });

  it("o rótulo é legível em minutos e em horas", () => {
    expect(rotuloDuracao(30)).toBe("30 min");
    expect(rotuloDuracao(60)).toBe("1h");
    expect(rotuloDuracao(90)).toBe("1h30");
    expect(rotuloDuracao(240)).toBe("4h");
  });
});
