"use client";
/**
 * Synapse — Hook central de módulos configuráveis.
 *
 * Fonte única para "este módulo está ligado?". Lê a config que vem do
 * /auth/me (já carregada no store pelo useAuth). Módulos OBRIGATÓRIOS
 * (financeiro, clientes, dashboard) são sempre ativos.
 *
 * Enquanto o usuário ainda não carregou, tudo é considerado ATIVO — evita
 * "piscar" itens sumindo do menu antes da config chegar.
 */
import { useCallback, useMemo } from "react";
import { useAppStore } from "@/store/useAppStore";
import type { ModuloOpcional, ModulosEmpresa } from "@/types/auth";
import { MODULOS_OPCIONAIS } from "@/types/auth";

export const MODULOS_OBRIGATORIOS = ["financeiro", "clientes", "dashboard"] as const;

/** Rota base de cada módulo opcional — usado pelo guard de rota e pelo menu. */
export const ROTA_DO_MODULO: Record<ModuloOpcional, string> = {
  estoque: "/estoque",
  fornecedores: "/fornecedores",
  projetos: "/projetos",
  agenda: "/agenda",
  equipe: "/equipe",
  documentos: "/documentos",
};

export const MODULO_LABEL: Record<ModuloOpcional, string> = {
  estoque: "Estoque",
  fornecedores: "Fornecedores",
  projetos: "Projetos",
  agenda: "Agenda",
  equipe: "Equipe",
  documentos: "Documentos",
};

const TODOS_ATIVOS: ModulosEmpresa = MODULOS_OPCIONAIS.reduce(
  (acc, m) => ({ ...acc, [m]: true }),
  {} as ModulosEmpresa
);

export function useModulos() {
  const usuario = useAppStore((s) => s.usuario);

  const modulos: ModulosEmpresa = useMemo(
    () => usuario?.modulos ?? TODOS_ATIVOS,
    [usuario?.modulos]
  );

  /** True se o módulo está ativo. Obrigatórios e desconhecidos → true. */
  const moduloAtivo = useCallback(
    (nome: string): boolean => {
      if ((MODULOS_OBRIGATORIOS as readonly string[]).includes(nome)) return true;
      if (!(nome in modulos)) return true;
      return modulos[nome as ModuloOpcional];
    },
    [modulos]
  );

  /** Dada uma rota (/estoque/123), diz se o módulo dono dela está ativo. */
  const rotaPermitida = useCallback(
    (pathname: string): boolean => {
      const entrada = (Object.entries(ROTA_DO_MODULO) as [ModuloOpcional, string][]).find(
        ([, rota]) => pathname === rota || pathname.startsWith(`${rota}/`)
      );
      return entrada ? moduloAtivo(entrada[0]) : true;
    },
    [moduloAtivo]
  );

  /** Nome do módulo dono da rota (para a mensagem do toast), ou null. */
  const moduloDaRota = useCallback((pathname: string): ModuloOpcional | null => {
    const entrada = (Object.entries(ROTA_DO_MODULO) as [ModuloOpcional, string][]).find(
      ([, rota]) => pathname === rota || pathname.startsWith(`${rota}/`)
    );
    return entrada ? entrada[0] : null;
  }, []);

  return { modulos, moduloAtivo, rotaPermitida, moduloDaRota };
}
