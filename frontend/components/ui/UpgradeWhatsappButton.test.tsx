/**
 * Botão de upgrade via WhatsApp:
 * - com NEXT_PUBLIC_WHATSAPP_UPGRADE definida → renderiza o link com a URL
 *   correta (nova aba) e a mensagem pré-preenchida com nome e plano;
 * - sem a variável → NÃO renderiza nada (degradação graciosa, sem erro).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { UpgradeWhatsappButton } from "./UpgradeWhatsappButton";

// useAuth mockado com um usuário/empresa fixos
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    usuario: { nome: "Maria" },
    empresa: { nome: "Padaria da Maria", plano: "starter" },
  }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("UpgradeWhatsappButton", () => {
  it("com env var: renderiza o botão com a URL do WhatsApp correta", () => {
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_UPGRADE", "5511999999999");
    render(<UpgradeWhatsappButton label="Fazer upgrade" />);

    const link = screen.getByRole("link", { name: /Fazer upgrade/i });
    const href = link.getAttribute("href")!;
    expect(href).toContain("https://wa.me/5511999999999?text=");
    expect(link).toHaveAttribute("target", "_blank");

    const texto = decodeURIComponent(href.split("text=")[1]);
    // Mensagem inclui nome do usuário e o rótulo do plano (Starter)
    expect(texto).toContain("Sou Maria da empresa Padaria da Maria");
    expect(texto).toContain("plano Starter");
  });

  it("sem env var: não renderiza nada e não quebra", () => {
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_UPGRADE", "");
    const { container } = render(
      <UpgradeWhatsappButton label="Fazer upgrade" />
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
