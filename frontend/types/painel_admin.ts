/**
 * Synapse — Tipos do Painel Administrativo (visão de plataforma).
 */

export type Plano = "starter" | "pro" | "business" | "enterprise";

export type StatusEmpresa = "ativa" | "suspensa";

export interface EmpresaAdminList {
  id: string;
  nome: string;
  segmento: string;
  plano: Plano;
  plano_ativo: boolean;
  ativo: boolean;
  status: StatusEmpresa;
  data_suspensao: string | null;
  num_usuarios: number;
  total_usuarios: number;
  ultimo_acesso: string | null;
  creditos_usados_hoje: number;
  creditos_usados_mes: number;
  total_lancamentos: number;
  total_clientes: number;
  criado_em: string;
}

export interface UsuarioAdmin {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  ativo: boolean;
  is_active: boolean;
  is_staff_synapse: boolean;
  ultimo_acesso: string | null;
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
  status: StatusEmpresa;
  data_suspensao: string | null;
  motivo_suspensao: string;
  suspensa_por_nome: string | null;
  num_usuarios: number;
  total_usuarios: number;
  ultimo_acesso: string | null;
  creditos_usados_hoje: number;
  creditos_usados_mes: number;
  total_lancamentos: number;
  total_clientes: number;
  usuarios: UsuarioAdmin[];
  criado_em: string;
  atualizado_em: string;
}

export interface LogAlteracaoPlano {
  id: string;
  acao: "troca_plano" | "criacao" | "suspenso" | "reativado";
  plano_anterior: string;
  plano_novo: string;
  observacao: string;
  status: "sucesso" | "erro";
  erro: string;
  alterado_por_nome: string | null;
  alterado_em: string;
}

export type PerfilUsuario = "admin" | "gerente" | "colaborador";

export interface CriarEmpresaPayload {
  nome_empresa: string;
  segmento: string;
  plano: Plano;
  admin_nome: string;
  admin_email: string;
  admin_senha: string;
}

/** Filtros/ordenação da lista de empresas. */
export type OrdenarEmpresas =
  | "cadastro"
  | "-cadastro"
  | "nome"
  | "-nome"
  | "uso"
  | "-uso";

export interface FiltrosEmpresas {
  busca?: string;
  plano?: Plano | "";
  status?: StatusEmpresa | "todas";
  ordenar?: OrdenarEmpresas;
}

export const PLANOS: { value: Plano; label: string }[] = [
  { value: "starter", label: "Starter" },
  { value: "pro", label: "Pro" },
  { value: "business", label: "Business" },
  { value: "enterprise", label: "Enterprise" },
];

export const SEGMENTOS: { value: string; label: string }[] = [
  { value: "varejo", label: "Varejo" },
  { value: "servicos", label: "Serviços" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "moda", label: "Moda" },
  { value: "eventos", label: "Eventos" },
  { value: "agencia", label: "Agência" },
  { value: "outro", label: "Outro" },
];

export const PERFIS: { value: PerfilUsuario; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "gerente", label: "Gerente" },
  { value: "colaborador", label: "Colaborador" },
];

/**
 * Indicador de saúde pelo último acesso (calculado no front):
 * 🟢 < 7 dias · 🟡 7–30 dias · 🔴 > 30 dias ou nunca.
 */
export type Saude = "verde" | "amarelo" | "vermelho";

export function saudePorUltimoAcesso(ultimoAcesso: string | null): Saude {
  if (!ultimoAcesso) return "vermelho";
  const dias = (Date.now() - new Date(ultimoAcesso).getTime()) / 86_400_000;
  if (dias < 7) return "verde";
  if (dias <= 30) return "amarelo";
  return "vermelho";
}

export const SAUDE_COR: Record<Saude, string> = {
  verde: "bg-emerald-500",
  amarelo: "bg-amber-500",
  vermelho: "bg-red-500",
};

export const SAUDE_LABEL: Record<Saude, string> = {
  verde: "Ativo nos últimos 7 dias",
  amarelo: "Último acesso entre 7 e 30 dias",
  vermelho: "Sem acesso há mais de 30 dias (ou nunca acessou)",
};

/** Excluir só é possível após 30 dias suspensa. Retorna se já pode. */
export function podeExcluir(
  status: StatusEmpresa,
  dataSuspensao: string | null
): boolean {
  if (status !== "suspensa" || !dataSuspensao) return false;
  const dias = (Date.now() - new Date(dataSuspensao).getTime()) / 86_400_000;
  return dias >= 30;
}
