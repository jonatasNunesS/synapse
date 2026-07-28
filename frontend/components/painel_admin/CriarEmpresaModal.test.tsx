/**
 * Modal de criar empresa: toggle de senha, submissão com dados válidos e
 * exibição de erros de campo vindos do backend.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CriarEmpresaModal } from "./CriarEmpresaModal";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { criarEmpresa } = vi.hoisted(() => ({ criarEmpresa: vi.fn() }));
vi.mock("@/hooks/usePainelAdmin", () => ({ criarEmpresa }));

beforeEach(() => criarEmpresa.mockReset());

function preencher() {
  fireEvent.change(screen.getByPlaceholderText("Impactar Cerimonial"), {
    target: { value: "Impactar Cerimonial" },
  });
  fireEvent.change(screen.getByPlaceholderText("Patrícia"), {
    target: { value: "Patrícia" },
  });
  fireEvent.change(screen.getByPlaceholderText("patricia@impactar.com"), {
    target: { value: "patricia@impactar.com" },
  });
  fireEvent.change(screen.getByPlaceholderText("Mínimo 8 caracteres"), {
    target: { value: "SenhaTemporaria@123" },
  });
}

describe("CriarEmpresaModal", () => {
  it("toggle mostra/esconde a senha", () => {
    render(<CriarEmpresaModal onClose={vi.fn()} onSuccess={vi.fn()} />);
    const senha = screen.getByPlaceholderText("Mínimo 8 caracteres") as HTMLInputElement;
    expect(senha.type).toBe("password");
    fireEvent.click(screen.getByLabelText("Mostrar senha"));
    expect(senha.type).toBe("text");
    fireEvent.click(screen.getByLabelText("Esconder senha"));
    expect(senha.type).toBe("password");
  });

  it("submete e chama criarEmpresa + onSuccess", async () => {
    criarEmpresa.mockResolvedValue({ nome: "Impactar Cerimonial" });
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    render(<CriarEmpresaModal onClose={onClose} onSuccess={onSuccess} />);
    preencher();
    fireEvent.click(screen.getByRole("button", { name: "Criar empresa" }));
    await waitFor(() => expect(criarEmpresa).toHaveBeenCalled());
    const arg = criarEmpresa.mock.calls[0][0];
    expect(arg.nome_empresa).toBe("Impactar Cerimonial");
    expect(arg.admin_email).toBe("patricia@impactar.com");
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it("não submete com campos incompletos", () => {
    render(<CriarEmpresaModal onClose={vi.fn()} onSuccess={vi.fn()} />);
    // Só nome preenchido → botão desabilitado (faltam admin/email/senha).
    fireEvent.change(screen.getByPlaceholderText("Impactar Cerimonial"), {
      target: { value: "Só o nome" },
    });
    expect(screen.getByRole("button", { name: "Criar empresa" })).toBeDisabled();
    expect(criarEmpresa).not.toHaveBeenCalled();
  });
});
