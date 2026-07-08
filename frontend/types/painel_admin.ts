/**
 * Synapse — Tipos do Painel Administrativo (visão de plataforma).
 */

export type Plano = "starter" | "pro" | "business" | "enterprise";

export interface EmpresaAdminList {
  id: string;
  nome: string;
  segmento: string;
  plano: Plano;
  plano_ativo: boolean;
  ativo: boolean;
  num_usuarios: number;
  creditos_usados_hoje: number;
  criado_em: string;
}

export interface UsuarioAdmin {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  ativo: boolean;
  is_staff_synapse: boolean;
  criado_em: string;
}

export interface EmpresaAdminDetail {
  id: string;
  nome: string;
  cnpj: string;
  segmento: string;
  plano: Plano;
  plano_ativo: boolean;
  plano_validade: string | null;
  ativo: boolean;
  num_usuarios: number;
  creditos_usados_hoje: number;
  usuarios: UsuarioAdmin[];
  criado_em: string;
  atualizado_em: string;
}

export interface LogAlteracaoPlano {
  id: string;
  plano_anterior: string;
  plano_novo: string;
  observacao: string;
  status: "sucesso" | "erro";
  erro: string;
  alterado_por_nome: string | null;
  alterado_em: string;
}

export const PLANOS: { value: Plano; label: string }[] = [
  { value: "starter", label: "Starter" },
  { value: "pro", label: "Pro" },
  { value: "business", label: "Business" },
  { value: "enterprise", label: "Enterprise" },
];
