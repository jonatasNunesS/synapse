/**
 * Módulos configuráveis — a Sidebar só mostra os módulos ativos da empresa.
 * Os obrigatórios (Dashboard, Financeiro, Clientes) nunca somem.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "./Sidebar";
import { useAppStore } from "@/store/useAppStore";
import type { ModulosEmpresa, Usuario } from "@/types/auth";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    usuario: { nome: "Fundador Teste", perfil: "admin" },
    empresa: { plano: "starter" },
    logout: vi.fn(),
  }),
}));

function setModulos(modulos: Partial<ModulosEmpresa>) {
  useAppStore.setState({
    usuario: { id: "u1", nome: "Fundador Teste", modulos } as unknown as Usuario,
  });
}

beforeEach(() => useAppStore.setState({ usuario: null, sidebarOpen: true }));

describe("Sidebar — módulos", () => {
  it("esconde os itens dos módulos desligados", () => {
    setModulos({
      estoque: false,
      fornecedores: true,
      projetos: false,
      agenda: true,
      equipe: false,
      documentos: true,
    });
    render(<Sidebar />);

    expect(screen.queryByText("Estoque")).not.toBeInTheDocument();
    expect(screen.queryByText("Projetos")).not.toBeInTheDocument();
    expect(screen.queryByText("Equipe")).not.toBeInTheDocument();

    expect(screen.getByText("Fornecedores")).toBeInTheDocument();
    expect(screen.getByText("Agenda")).toBeInTheDocument();
    expect(screen.getByText("Documentos")).toBeInTheDocument();
  });

  it("mantém os módulos obrigatórios mesmo com todos os opcionais desligados", () => {
    setModulos({
      estoque: false,
      fornecedores: false,
      projetos: false,
      agenda: false,
      equipe: false,
      documentos: false,
    });
    render(<Sidebar />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Financeiro")).toBeInTheDocument();
    expect(screen.getByText("Clientes")).toBeInTheDocument();
    // Nenhum opcional sobrou
    expect(screen.queryByText("Estoque")).not.toBeInTheDocument();
    expect(screen.queryByText("Fornecedores")).not.toBeInTheDocument();
    expect(screen.queryByText("Documentos")).not.toBeInTheDocument();
  });

  it("com tudo ligado mostra todos os módulos", () => {
    setModulos({
      estoque: true,
      fornecedores: true,
      projetos: true,
      agenda: true,
      equipe: true,
      documentos: true,
    });
    render(<Sidebar />);

    expect(screen.getByText("Estoque")).toBeInTheDocument();
    expect(screen.getByText("Projetos")).toBeInTheDocument();
    expect(screen.getByText("Equipe")).toBeInTheDocument();
  });
});
