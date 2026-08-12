/**
 * Perfil → Suas preferências: os quatro níveis, cada um no próprio tamanho,
 * e a aplicação no <html> ao salvar.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PreferenciasSection } from "./PreferenciasSection";
import { useAppStore } from "@/store/useAppStore";
import type { Usuario } from "@/types/auth";
import { COOKIE_TAMANHO, limparTamanhoDoCookie } from "@/lib/preferencias";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const patch = vi.fn();
vi.mock("@/lib/api", async () => {
  const real = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...real, api: { patch: (...args: unknown[]) => patch(...args) } };
});

function montarStore(
  tamanho: Usuario["tamanho_fonte"] = "normal",
  perfil: Usuario["perfil"] = "colaborador"
) {
  useAppStore.setState({
    usuario: {
      id: "u1",
      nome: "Fulano",
      perfil,
      tamanho_fonte: tamanho,
    } as unknown as Usuario,
  });
}

beforeEach(() => {
  patch.mockReset();
  patch.mockImplementation((_url: string, body: Record<string, string>) =>
    Promise.resolve({ success: true, data: body })
  );
  delete document.documentElement.dataset.fonteTamanho;
  limparTamanhoDoCookie();
  montarStore();
});

describe("Suas preferências", () => {
  it("mostra os quatro níveis de tamanho", () => {
    render(<PreferenciasSection />);

    const grupo = screen.getByRole("radiogroup", { name: "Tamanho do texto" });
    expect(grupo.querySelectorAll('[role="radio"]')).toHaveLength(4);
    ["Normal", "Médio", "Grande", "Maior"].forEach((nome) =>
      expect(screen.getByRole("radio", { name: nome })).toBeInTheDocument()
    );
  });

  it("cada opção é renderizada no próprio tamanho", () => {
    render(<PreferenciasSection />);

    const amostras = screen.getAllByText(/^Aa/);
    expect(amostras).toHaveLength(4);

    const tamanhos = amostras.map((a) =>
      parseFloat((a as HTMLElement).style.fontSize)
    );
    // 0.875rem (o text-sm da interface) vezes a escala de cada nível.
    expect(tamanhos).toEqual([0.875, 0.984375, 1.09375, 1.203125]);
    for (let i = 1; i < tamanhos.length; i++) {
      expect(tamanhos[i]).toBeGreaterThan(tamanhos[i - 1]);
    }
  });

  it("começa marcando a preferência que o usuário já tem", () => {
    montarStore("grande");
    render(<PreferenciasSection />);

    expect(screen.getByRole("radio", { name: "Grande" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("radio", { name: "Normal" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });

  it("selecionar não aplica nem salva sozinho", () => {
    render(<PreferenciasSection />);

    fireEvent.click(screen.getByRole("radio", { name: "Maior" }));

    expect(screen.getByRole("radio", { name: "Maior" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(patch).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.fonteTamanho).toBeUndefined();
  });

  it("salvar aplica no <html> e guarda no cookie, sem reload", async () => {
    render(<PreferenciasSection />);

    fireEvent.click(screen.getByRole("radio", { name: "Maior" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith("/auth/me/preferencias/", {
        tamanho_fonte: "maior",
      })
    );
    await waitFor(() =>
      expect(document.documentElement.dataset.fonteTamanho).toBe("maior")
    );
    expect(document.cookie).toContain(`${COOKIE_TAMANHO}=maior`);
    expect(useAppStore.getState().usuario?.tamanho_fonte).toBe("maior");
  });

  it("sem mudança, o botão fica inativo", () => {
    render(<PreferenciasSection />);
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: "Médio" }));
    expect(screen.getByRole("button", { name: "Salvar" })).not.toBeDisabled();
  });

  it("qualquer perfil pode ajustar o próprio tamanho", async () => {
    montarStore("normal", "colaborador");
    render(<PreferenciasSection />);

    // Sem aviso de permissão e sem controle desabilitado.
    expect(screen.queryByText(/administradores/i)).not.toBeInTheDocument();
    screen
      .getAllByRole("radio")
      .forEach((botao) => expect(botao).not.toBeDisabled());

    fireEvent.click(screen.getByRole("radio", { name: "Grande" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(patch).toHaveBeenCalled());
  });
});
