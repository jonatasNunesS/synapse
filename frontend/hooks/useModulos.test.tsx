/**
 * Hook central de módulos: obrigatórios sempre ativos, opcionais respeitam a
 * config da empresa, e o guard de rota reconhece a rota do módulo.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useModulos } from "./useModulos";
import { useAppStore } from "@/store/useAppStore";
import type { ModulosEmpresa, Usuario } from "@/types/auth";

function setModulos(modulos: Partial<ModulosEmpresa> | undefined) {
  useAppStore.setState({
    usuario: modulos ? ({ id: "u1", modulos } as unknown as Usuario) : null,
  });
}

beforeEach(() => setModulos(undefined));

describe("useModulos", () => {
  it("sem usuário carregado, tudo é considerado ativo", () => {
    const { result } = renderHook(() => useModulos());
    expect(result.current.moduloAtivo("estoque")).toBe(true);
    expect(result.current.moduloAtivo("equipe")).toBe(true);
  });

  it("respeita a config da empresa nos opcionais", () => {
    setModulos({ estoque: false, agenda: true, equipe: false });
    const { result } = renderHook(() => useModulos());
    expect(result.current.moduloAtivo("estoque")).toBe(false);
    expect(result.current.moduloAtivo("equipe")).toBe(false);
    expect(result.current.moduloAtivo("agenda")).toBe(true);
  });

  it("módulos obrigatórios são sempre ativos", () => {
    setModulos({ estoque: false });
    const { result } = renderHook(() => useModulos());
    expect(result.current.moduloAtivo("financeiro")).toBe(true);
    expect(result.current.moduloAtivo("clientes")).toBe(true);
    expect(result.current.moduloAtivo("dashboard")).toBe(true);
  });

  it("rotaPermitida bloqueia a rota do módulo desligado (inclusive sub-rotas)", () => {
    setModulos({ estoque: false, projetos: true });
    const { result } = renderHook(() => useModulos());
    expect(result.current.rotaPermitida("/estoque")).toBe(false);
    expect(result.current.rotaPermitida("/estoque/123")).toBe(false);
    expect(result.current.rotaPermitida("/projetos")).toBe(true);
    // Rotas de módulos obrigatórios nunca bloqueiam
    expect(result.current.rotaPermitida("/financeiro")).toBe(true);
    expect(result.current.rotaPermitida("/")).toBe(true);
  });

  it("moduloDaRota identifica o dono da rota", () => {
    const { result } = renderHook(() => useModulos());
    expect(result.current.moduloDaRota("/equipe/abc")).toBe("equipe");
    expect(result.current.moduloDaRota("/financeiro")).toBeNull();
  });
});
