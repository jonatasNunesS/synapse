/**
 * O rodapé da Sidebar mostra "Synapse v{versão}" — referência técnica
 * discreta para o fundador confirmar, batendo o olho, que o build no ar
 * é o atual. A versão vem de NEXT_PUBLIC_APP_VERSION (injetada do
 * package.json no build).
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";

// Mocks das dependências da Sidebar (não são o foco do teste)
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@/store/useAppStore", () => ({
  useAppStore: () => ({
    sidebarOpen: true, // aberto: o rodapé de versão só renderiza expandido
    toggleSidebar: vi.fn(),
    setSidebarOpen: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    usuario: { nome: "Fundador Teste", perfil: "admin" },
    empresa: { plano: "starter" },
    logout: vi.fn(),
  }),
}));

describe("Sidebar — rodapé de versão", () => {
  beforeAll(() => {
    // Simula a injeção de build antes de a Sidebar/lib de versão avaliarem o env
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "0.2.0");
    vi.stubEnv("NEXT_PUBLIC_GIT_SHA", "dev");
  });

  it('renderiza "Synapse v0.2.0" no rodapé', async () => {
    // Import dinâmico para pegar o env já com o stub aplicado
    const { Sidebar } = await import("./Sidebar");
    render(<Sidebar />);
    expect(screen.getByText("Synapse v0.2.0")).toBeInTheDocument();
  });
});
