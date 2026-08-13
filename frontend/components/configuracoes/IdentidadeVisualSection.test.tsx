/**
 * Configurações → Identidade visual: seleção de paleta/fonte, preview ao vivo,
 * trava para quem não é admin e aplicação no <html> ao salvar.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { IdentidadeVisualSection } from "./IdentidadeVisualSection";
import { useAppStore } from "@/store/useAppStore";
import type { Empresa, Usuario } from "@/types/auth";
import { COOKIE_TEMA, limparTemaDoCookie } from "@/lib/tema";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const patch = vi.fn();
vi.mock("@/lib/api", async () => {
  const real = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...real, api: { patch: (...args: unknown[]) => patch(...args) } };
});

function montarStore(
  perfil: "admin" | "colaborador",
  tema: Partial<Empresa> = {}
) {
  const empresa = {
    id: "e1",
    nome: "Alfa",
    tema_paleta: "synapse",
    tema_fonte: "padrao",
    ...tema,
  } as Empresa;
  useAppStore.setState({
    usuario: { id: "u1", nome: "Fulano", perfil, empresa } as unknown as Usuario,
    empresa,
  });
}

beforeEach(() => {
  patch.mockReset();
  patch.mockImplementation((_url: string, body: Record<string, string>) =>
    Promise.resolve({ success: true, data: body })
  );
  delete document.documentElement.dataset.tema;
  delete document.documentElement.dataset.fonte;
  limparTemaDoCookie();
  montarStore("admin");
});

describe("Identidade visual", () => {
  it("mostra as cinco paletas e as cinco fontes", () => {
    render(<IdentidadeVisualSection />);

    const paletas = screen.getByRole("radiogroup", { name: "Paleta de cores" });
    expect(paletas.querySelectorAll('[role="radio"]')).toHaveLength(5);
    ["Synapse", "Oceano", "Floresta", "Âmbar", "Grafite"].forEach((nome) =>
      expect(screen.getByRole("radio", { name: nome })).toBeInTheDocument()
    );

    const fontes = screen.getByRole("radiogroup", { name: "Fonte dos títulos" });
    expect(fontes.querySelectorAll('[role="radio"]')).toHaveLength(5);
    ["Padrão", "Serifada", "Geométrica", "IBM Plex Sans", "Figtree"].forEach(
      (nome) =>
        expect(screen.getByRole("radio", { name: nome })).toBeInTheDocument()
    );
  });

  it("começa marcando o que a empresa já usa", () => {
    montarStore("admin", { tema_paleta: "oceano", tema_fonte: "serifada" });
    render(<IdentidadeVisualSection />);

    expect(screen.getByRole("radio", { name: "Oceano" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("radio", { name: "Synapse" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.getByRole("radio", { name: "Serifada" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("selecionar uma paleta atualiza o preview antes de salvar", () => {
    render(<IdentidadeVisualSection />);
    const botaoPreview = () => screen.getByText("Novo lançamento");

    // Padrão: roxo do Synapse
    expect(botaoPreview()).toHaveStyle({ background: "#6D28D9" });

    fireEvent.click(screen.getByRole("radio", { name: "Floresta" }));

    expect(screen.getByRole("radio", { name: "Floresta" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(botaoPreview()).toHaveStyle({ background: "#047857" });
    // Nada foi salvo ainda, e o tema real não mudou.
    expect(patch).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.tema).toBeUndefined();
  });

  it("selecionar uma fonte troca a família do preview", () => {
    render(<IdentidadeVisualSection />);

    fireEvent.click(screen.getByRole("radio", { name: "Geométrica" }));

    expect(screen.getByText("Resumo do mês")).toHaveStyle({
      fontFamily: "var(--font-geometrica), var(--font-inter), sans-serif",
    });
  });

  it("o preview mantém as cores semânticas em qualquer paleta", () => {
    render(<IdentidadeVisualSection />);
    fireEvent.click(screen.getByRole("radio", { name: "Floresta" }));

    // Sucesso continua verde e erro continua vermelho, com paleta verde.
    expect(screen.getByText("+ R$ 2.800,92").className).toContain("text-emerald-400");
    expect(screen.getByText("− R$ 320,00").className).toContain("text-red-400");
  });

  it("salvar manda a escolha e aplica no <html> sem reload", async () => {
    render(<IdentidadeVisualSection />);

    fireEvent.click(screen.getByRole("radio", { name: "Âmbar" }));
    fireEvent.click(screen.getByRole("radio", { name: "Serifada" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith("/auth/empresa/tema/", {
        tema_paleta: "ambar",
        tema_fonte: "serifada",
      })
    );
    await waitFor(() =>
      expect(document.documentElement.dataset.tema).toBe("ambar")
    );
    expect(document.documentElement.dataset.fonte).toBe("serifada");
    // E fica guardado para o próximo carregamento nascer já na cor certa.
    expect(document.cookie).toContain(`${COOKIE_TEMA}=ambar.serifada`);
  });

  it("sem mudança, o botão de salvar fica inativo", () => {
    render(<IdentidadeVisualSection />);
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: "Grafite" }));
    expect(screen.getByRole("button", { name: "Salvar" })).not.toBeDisabled();
  });

  it("quem não é admin vê a config mas não mexe", () => {
    montarStore("colaborador", { tema_paleta: "grafite" });
    render(<IdentidadeVisualSection />);

    expect(
      screen.getByText("Só administradores podem alterar a identidade visual.")
    ).toBeInTheDocument();
    // A paleta atual continua visível…
    expect(screen.getByRole("radio", { name: "Grafite" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    // …mas os controles estão desabilitados.
    screen
      .getAllByRole("radio")
      .forEach((botao) => expect(botao).toBeDisabled());
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: "Oceano" }));
    expect(screen.getByRole("radio", { name: "Oceano" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(patch).not.toHaveBeenCalled();
  });
});
