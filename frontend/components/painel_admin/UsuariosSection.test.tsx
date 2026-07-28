/**
 * Seção de usuários: usuário staff da plataforma aparece com badge e sem ações;
 * usuário comum tem select de perfil + botões; redefinir senha exibe a senha
 * temporária retornada.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { UsuariosSection } from "./UsuariosSection";
import type { UsuarioAdmin } from "@/types/painel_admin";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const editarUsuario = vi.fn().mockResolvedValue(undefined);
const redefinirSenhaUsuario = vi.fn().mockResolvedValue("NovaSenha@23");
vi.mock("@/hooks/usePainelAdmin", () => ({
  editarUsuario: (...a: unknown[]) => editarUsuario(...a),
  redefinirSenhaUsuario: (...a: unknown[]) => redefinirSenhaUsuario(...a),
}));

function usuario(over: Partial<UsuarioAdmin>): UsuarioAdmin {
  return {
    id: "u1", nome: "João", email: "joao@x.com", perfil: "colaborador",
    ativo: true, is_active: true, is_staff_synapse: false,
    ultimo_acesso: null, criado_em: "2026-01-01T00:00:00Z", ...over,
  };
}

beforeEach(() => {
  editarUsuario.mockClear();
  redefinirSenhaUsuario.mockClear();
});

describe("UsuariosSection", () => {
  it("usuário staff mostra badge e NÃO tem ações", () => {
    render(
      <UsuariosSection
        empresaId="e1"
        usuarios={[usuario({ id: "s1", nome: "Staff", is_staff_synapse: true })]}
        onMutate={vi.fn()}
      />
    );
    expect(screen.getByText("Staff Synapse")).toBeInTheDocument();
    expect(screen.getByText("ações bloqueadas")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("mudar o perfil chama editarUsuario", async () => {
    const onMutate = vi.fn();
    render(
      <UsuariosSection empresaId="e1" usuarios={[usuario({})]} onMutate={onMutate} />
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "gerente" } });
    await waitFor(() =>
      expect(editarUsuario).toHaveBeenCalledWith("e1", "u1", { perfil: "gerente" })
    );
  });

  it("desativar chama editarUsuario com is_active=false", async () => {
    render(
      <UsuariosSection empresaId="e1" usuarios={[usuario({})]} onMutate={vi.fn()} />
    );
    fireEvent.click(screen.getByTitle("Desativar usuário"));
    await waitFor(() =>
      expect(editarUsuario).toHaveBeenCalledWith("e1", "u1", { is_active: false })
    );
  });

  it("redefinir senha exibe a senha temporária retornada", async () => {
    render(
      <UsuariosSection empresaId="e1" usuarios={[usuario({})]} onMutate={vi.fn()} />
    );
    fireEvent.click(screen.getByTitle("Redefinir senha"));
    expect(await screen.findByText("NovaSenha@23")).toBeInTheDocument();
    expect(screen.getByText(/Senha temporária de João/)).toBeInTheDocument();
  });

  it("usuário inativo mostra o marcador 'Inativo'", () => {
    render(
      <UsuariosSection
        empresaId="e1"
        usuarios={[usuario({ is_active: false, ativo: false })]}
        onMutate={vi.fn()}
      />
    );
    const linha = screen.getByText("João").closest("div")!.parentElement as HTMLElement;
    expect(within(linha).getByText("Inativo")).toBeInTheDocument();
    // Botão para reativar disponível
    expect(screen.getByTitle("Reativar usuário")).toBeInTheDocument();
  });
});
