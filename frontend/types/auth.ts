/**
 * Synapse — M1: Tipos de Autenticação
 */

export interface Empresa {
  id: string;
  nome: string;
  cnpj: string;
  segmento: string;
  plano: "starter" | "pro" | "business" | "enterprise";
  plano_ativo: boolean;
  plano_validade: string | null;
  ativo: boolean;
  criado_em: string;
}

export interface Usuario {
  id: string;
  email: string;
  nome: string;
  perfil: "admin" | "gerente" | "colaborador";
  avatar_url: string;
  ativo: boolean;
  empresa: Empresa | null;
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
