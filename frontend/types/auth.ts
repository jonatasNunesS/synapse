/**
 * Synapse — M1: Tipos de Autenticação
 */

import type { FonteTema, Paleta } from "@/lib/tema";

export interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
  segmento: string;
  plano: "starter" | "pro" | "business" | "enterprise";
  plano_ativo: boolean;
  plano_validade: string | null;
  ativo: boolean;
  /** ativa | suspensa — empresa suspensa loga mas vê a tela de aviso. */
  status: "ativa" | "suspensa";
  /** Identidade visual (white-label) — vale para toda a equipe. */
  tema_paleta: Paleta;
  tema_fonte: FonteTema;
  criado_em: string;
}

/** Módulos OPCIONAIS — cada empresa liga/desliga. Os obrigatórios não entram. */
export type ModuloOpcional =
  | "estoque"
  | "fornecedores"
  | "projetos"
  | "agenda"
  | "equipe"
  | "documentos";

export type ModulosEmpresa = Record<ModuloOpcional, boolean>;

export const MODULOS_OPCIONAIS: ModuloOpcional[] = [
  "estoque",
  "fornecedores",
  "projetos",
  "agenda",
  "equipe",
  "documentos",
];

export interface Usuario {
  id: string;
  email: string;
  nome: string;
  perfil: "admin" | "gerente" | "colaborador";
  avatar_url: string;
  ativo: boolean;
  is_staff_synapse: boolean;
  viu_aviso_recorrencias: boolean;
  empresa: Empresa | null;
  /** Config de módulos da empresa (vem do /auth/me e do login). */
  modulos?: ModulosEmpresa;
  criado_em: string;
}

export interface AuthState {
  usuario: Usuario | null;
  empresa: Empresa | null;
  loading: boolean;
  autenticado: boolean;
}

// ── Payloads de Request ──────────────────────────────────────

export interface LoginPayload {
  email: string;
  senha: string;
}

export interface RegistroPayload {
  nome_usuario: string;
  email: string;
  senha: string;
  confirmar_senha: string;
  nome_empresa: string;
  segmento: string;
  // Etapa 3 do cadastro — as respostas configuram os módulos.
  modulo_estoque?: boolean;
  modulo_fornecedores?: boolean;
  modulo_projetos?: boolean;
  modulo_agenda?: boolean;
  modulo_equipe?: boolean;
  modulo_documentos?: boolean;
}

export interface RecuperarSenhaPayload {
  email: string;
}

export interface RedefinirSenhaPayload {
  token: string;
  nova_senha: string;
  confirmar_senha: string;
}

export interface AtualizarPerfilPayload {
  nome?: string;
  avatar_url?: string;
}

// ── Segmentos disponíveis ────────────────────────────────────

export const SEGMENTOS = [
  { value: "varejo", label: "Varejo" },
  { value: "servicos", label: "Serviços" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "moda", label: "Moda" },
  { value: "eventos", label: "Eventos" },
  { value: "agencia", label: "Agência" },
  { value: "outro", label: "Outro" },
] as const;

export const PLANO_LABELS: Record<Empresa["plano"], string> = {
  starter: "Starter",
  pro: "Pro",
  business: "Business",
  enterprise: "Enterprise",
};

export const PLANO_CORES: Record<Empresa["plano"], string> = {
  starter: "bg-slate-500",
  pro: "bg-violet-600",
  business: "bg-sky-500",
  enterprise: "bg-amber-500",
};
