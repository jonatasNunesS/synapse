/**
 * Exclusão definitiva: o botão só habilita com o nome EXATO da empresa + senha
 * preenchida (tripla proteção). Ao confirmar, a senha é verificada por login
 * antes de excluir.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ExcluirEmpresaModal } from "./ExcluirEmpresaModal";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const post = vi.fn();
vi.mock("@/lib/api", () => ({
  api: { post: (...a: unknown[]) => post(...a) },
  getErrorMessage: () => "erro",
}));

const excluirEmpresa = vi.fn().mockResolvedValue(undefined);
vi.mock("@/hooks/usePainelAdmin", () => ({
  excluirEmpresa: (...a: unknown[]) => excluirEmpresa(...a),
}));

beforeEach(() => {
  post.mockReset();
  excluirEmpresa.mockClear();
});

function setup() {
  const onExcluida = vi.fn();
  render(
    <ExcluirEmpresaModal
      empresaId="e1"
      empresaNome="Acme Ltda"
      staffEmail="staff@synapse.com"
      onClose={vi.fn()}
      onExcluida={onExcluida}
    />
  );
  return { onExcluida };
}

const botao = () => screen.getByRole("button", { name: "Excluir definitivamente" });

describe("ExcluirEmpresaModal", () => {
  it("botão desabilitado até nome exato + senha", () => {
    setup();
    expect(botao()).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Nome da empresa"), {
      target: { value: "Acme errado" },
    });
    fireEvent.change(screen.getByPlaceholderText("Sua senha"), {
      target: { value: "x" },
    });
    expect(botao()).toBeDisabled(); // nome não confere

    fireEvent.change(screen.getByPlaceholderText("Nome da empresa"), {
      target: { value: "Acme Ltda" },
    });
    expect(botao()).toBeEnabled();
  });

  it("confirma a senha por login antes de excluir", async () => {
    post.mockResolvedValue({ success: true });
    const { onExcluida } = setup();
    fireEvent.change(screen.getByPlaceholderText("Nome da empresa"), {
      target: { value: "Acme Ltda" },
    });
    fireEvent.change(screen.getByPlaceholderText("Sua senha"), {
      target: { value: "MinhaSenha@1" },
    });
    fireEvent.click(botao());
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/auth/login/", {
        email: "staff@synapse.com",
        senha: "MinhaSenha@1",
      })
    );
    await waitFor(() => expect(excluirEmpresa).toHaveBeenCalledWith("e1"));
    await waitFor(() => expect(onExcluida).toHaveBeenCalled());
  });

  it("senha errada (login falha) NÃO exclui", async () => {
    post.mockRejectedValue(new Error("401"));
    const { onExcluida } = setup();
    fireEvent.change(screen.getByPlaceholderText("Nome da empresa"), {
      target: { value: "Acme Ltda" },
    });
    fireEvent.change(screen.getByPlaceholderText("Sua senha"), {
      target: { value: "errada" },
    });
    fireEvent.click(botao());
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(excluirEmpresa).not.toHaveBeenCalled();
    expect(onExcluida).not.toHaveBeenCalled();
  });
});
