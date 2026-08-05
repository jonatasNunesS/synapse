/**
 * Configurações → Módulos: liga/desliga cada módulo opcional, trava os
 * essenciais e, ao desligar um módulo que já tem dados, avisa antes
 * (deixando claro que nada é apagado).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { ModulosSection } from "./ModulosSection";
import { useAppStore } from "@/store/useAppStore";
import type { Usuario } from "@/types/auth";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const config = {
  modulos: {
    estoque: true,
    fornecedores: false,
    projetos: true,
    agenda: true,
    equipe: true,
    documentos: true,
  },
  obrigatorios: ["financeiro", "clientes", "dashboard"],
  info: {
    estoque: { label: "Estoque", descricao: "Produtos e movimentações", icone: "📦" },
    fornecedores: { label: "Fornecedores", descricao: "Compras", icone: "🏭" },
    projetos: { label: "Projetos", descricao: "Projetos e tarefas", icone: "📋" },
    agenda: { label: "Agenda", descricao: "Eventos", icone: "📅" },
    equipe: { label: "Equipe", descricao: "Membros", icone: "👥" },
    documentos: { label: "Documentos", descricao: "Arquivos", icone: "📄" },
  },
  // Estoque tem dados; Projetos está zerado.
  contagens: {
    estoque: 7,
    fornecedores: 0,
    projetos: 0,
    agenda: 0,
    equipe: 0,
    documentos: 0,
  },
};

const get = vi.fn().mockResolvedValue({ success: true, data: config });
const patch = vi.fn().mockImplementation((_url: string, body: Record<string, boolean>) => {
  const [campo, valor] = Object.entries(body)[0];
  return Promise.resolve({
    success: true,
    data: { modulos: { ...config.modulos, [campo.replace("modulo_", "")]: valor } },
  });
});

vi.mock("@/lib/api", async () => {
  const real = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...real,
    api: {
      get: (...args: unknown[]) => get(...args),
      patch: (...args: unknown[]) => patch(...args),
    },
  };
});

function setUsuario(perfil: "admin" | "membro") {
  useAppStore.setState({
    usuario: { id: "u1", nome: "Fundador", perfil } as unknown as Usuario,
  });
}

beforeEach(() => {
  get.mockClear();
  patch.mockClear();
  setUsuario("admin");
});

describe("Configurações → Módulos", () => {
  it("lista opcionais com o estado atual e trava os essenciais", async () => {
    render(<ModulosSection />);
    await waitFor(() => expect(get).toHaveBeenCalledWith("/auth/empresa/modulos/"));

    expect(await screen.findByText("Estoque")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Estoque" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("switch", { name: "Fornecedores" })).toHaveAttribute(
      "aria-checked",
      "false"
    );

    // Essenciais: presentes, ligados e desabilitados
    const essencial = screen.getByRole("switch", { name: "Financeiro (essencial)" });
    expect(essencial).toBeDisabled();
    expect(essencial).toHaveAttribute("aria-checked", "true");
  });

  it("ligar um módulo desligado salva na hora (sem confirmação)", async () => {
    render(<ModulosSection />);
    const toggle = await screen.findByRole("switch", { name: "Fornecedores" });

    fireEvent.click(toggle);

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith("/auth/empresa/modulos/", {
        modulo_fornecedores: true,
      })
    );
    // O store é atualizado para a sidebar reagir na hora
    await waitFor(() =>
      expect(useAppStore.getState().usuario?.modulos?.fornecedores).toBe(true)
    );
  });

  it("desligar um módulo SEM dados salva direto", async () => {
    render(<ModulosSection />);
    const toggle = await screen.findByRole("switch", { name: "Projetos" });

    fireEvent.click(toggle);

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith("/auth/empresa/modulos/", {
        modulo_projetos: false,
      })
    );
    expect(screen.queryByText("Desativar Projetos?")).not.toBeInTheDocument();
  });

  it("desligar um módulo COM dados pede confirmação e garante que nada é apagado", async () => {
    render(<ModulosSection />);
    const toggle = await screen.findByRole("switch", { name: "Estoque" });

    fireEvent.click(toggle);

    // Modal de aviso apareceu e ainda NÃO salvou
    const titulo = await screen.findByText("Desativar Estoque?");
    const modal = titulo.closest("div.fixed") as HTMLElement;
    expect(within(modal).getByText("7 registros")).toBeInTheDocument();
    expect(within(modal).getByText("nenhum dado será apagado")).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();

    // Cancelar não salva
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() =>
      expect(screen.queryByText("Desativar Estoque?")).not.toBeInTheDocument()
    );
    expect(patch).not.toHaveBeenCalled();

    // Confirmar salva
    fireEvent.click(screen.getByRole("switch", { name: "Estoque" }));
    fireEvent.click(await screen.findByRole("button", { name: "Desativar" }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith("/auth/empresa/modulos/", {
        modulo_estoque: false,
      })
    );
  });

  it("usuário não-admin vê o aviso e não consegue alternar", async () => {
    setUsuario("membro");
    render(<ModulosSection />);

    expect(
      await screen.findByText("Apenas administradores podem ativar ou desativar módulos.")
    ).toBeInTheDocument();
    const toggle = screen.getByRole("switch", { name: "Estoque" });
    expect(toggle).toBeDisabled();
    fireEvent.click(toggle);
    expect(patch).not.toHaveBeenCalled();
  });
});
