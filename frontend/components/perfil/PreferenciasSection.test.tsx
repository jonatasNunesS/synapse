/**
 * Perfil → Suas preferências: os quatro níveis, cada um no próprio tamanho,
 * e a aplicação no <html> ao salvar.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PreferenciasSection } from "./PreferenciasSection";
import { useAppStore } from "@/store/useAppStore";
import type { Usuario } from "@/types/auth";
import {
  COOKIE_MODO,
  COOKIE_TAMANHO,
  limparModoDoCookie,
  limparTamanhoDoCookie,
} from "@/lib/preferencias";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const patch = vi.fn();
vi.mock("@/lib/api", async () => {
  const real = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...real, api: { patch: (...args: unknown[]) => patch(...args) } };
});

function montarStore(
  tamanho: Usuario["tamanho_fonte"] = "normal",
  perfil: Usuario["perfil"] = "colaborador",
  modo: Usuario["tema_modo"] = "sistema"
) {
  useAppStore.setState({
    usuario: {
      id: "u1",
      nome: "Fulano",
      perfil,
      tamanho_fonte: tamanho,
      tema_modo: modo,
    } as unknown as Usuario,
  });
}

beforeEach(() => {
  patch.mockReset();
  patch.mockImplementation((_url: string, body: Record<string, string>) =>
    Promise.resolve({ success: true, data: body })
  );
  delete document.documentElement.dataset.fonteTamanho;
  delete document.documentElement.dataset.modo;
  document.documentElement.classList.remove("dark");
  limparTamanhoDoCookie();
  limparModoDoCookie();
  window.matchMedia = ((consulta: string) => ({
    matches: consulta.includes("dark"),
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
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


describe("Aparência", () => {
  it("mostra as três opções", () => {
    render(<PreferenciasSection />);

    const grupo = screen.getByRole("radiogroup", { name: "Aparência" });
    expect(grupo.querySelectorAll('[role="radio"]')).toHaveLength(3);
    ["Claro", "Escuro", "Sistema"].forEach((nome) =>
      expect(screen.getByRole("radio", { name: nome })).toBeInTheDocument()
    );
  });

  it("começa marcando a preferência que o usuário já tem", () => {
    montarStore("normal", "colaborador", "claro");
    render(<PreferenciasSection />);

    expect(screen.getByRole("radio", { name: "Claro" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("radio", { name: "Escuro" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });

  it("aplica na hora ao clicar, sem passar pelo Salvar", async () => {
    render(<PreferenciasSection />);

    fireEvent.click(screen.getByRole("radio", { name: "Claro" }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith("/auth/me/preferencias/", {
        tema_modo: "claro",
      })
    );
    expect(document.documentElement.dataset.modo).toBe("claro");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.cookie).toContain(`${COOKIE_MODO}=claro`);
    expect(useAppStore.getState().usuario?.tema_modo).toBe("claro");
  });

  it("'sistema' consulta o SO para decidir o que pintar", async () => {
    montarStore("normal", "colaborador", "claro");
    render(<PreferenciasSection />);

    // O matchMedia do beforeEach responde "escuro" para o SO.
    fireEvent.click(screen.getByRole("radio", { name: "Sistema" }));

    await waitFor(() =>
      expect(document.documentElement.dataset.modo).toBe("escuro")
    );
    // No cookie fica a ESCOLHA, não o resultado.
    expect(document.cookie).toContain(`${COOKIE_MODO}=sistema`);
  });

  it("se o servidor recusar, desfaz o que já tinha aplicado", async () => {
    patch.mockReset();
    patch.mockRejectedValue(new Error("sem rede"));
    montarStore("normal", "colaborador", "escuro");
    render(<PreferenciasSection />);

    fireEvent.click(screen.getByRole("radio", { name: "Claro" }));

    await waitFor(() =>
      expect(document.documentElement.dataset.modo).toBe("escuro")
    );
    expect(useAppStore.getState().usuario?.tema_modo).toBe("escuro");
  });

  it("qualquer perfil ajusta a própria aparência", () => {
    montarStore("normal", "colaborador");
    render(<PreferenciasSection />);

    screen
      .getByRole("radiogroup", { name: "Aparência" })
      .querySelectorAll('[role="radio"]')
      .forEach((b) => expect(b).not.toBeDisabled());
  });
});
