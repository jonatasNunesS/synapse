// Synapse — M7: Types do módulo Equipe

export type CargoEquipe = string;
export type DepartamentoEquipe = string;

export type TipoMeta = "vendas" | "tarefas" | "projetos" | "atendimentos" | "outro";
export type PeriodoMeta = "diario" | "semanal" | "mensal" | "trimestral" | "anual";

export interface MembroEquipe {
  id: string;
  usuario_id: string;
  nome: string;
  email: string;
  cargo: string;
  departamento: string;
  ativo: boolean;
  data_admissao: string | null;
  salario: string | null;
  observacoes: string;
  total_metas: number;
  metas_atingidas: number;
  criado_em: string;
  atualizado_em: string;
}

export interface MetaMembro {
  id: string;
  titulo: string;
  tipo: TipoMeta;
  valor_meta: string;
  valor_atual: string;
  progresso_percentual: number;
  periodo: PeriodoMeta;
  data_inicio: string;
  data_fim: string;
  atingida: boolean;
  observacoes: string;
  criado_em: string;
}

export interface ResumoEquipe {
  total_membros: number;
  membros_ativos: number;
  membros_inativos: number;
  departamentos: Record<string, number>;
  metas_ativas: number;
  metas_atingidas: number;
}

export interface MembroFormData {
  usuario_id: string;
  cargo: string;
  departamento?: string;
  data_admissao?: string;
  salario?: string;
  observacoes?: string;
}

export interface MetaFormData {
  titulo: string;
  tipo: TipoMeta;
  valor_meta: string;
  valor_atual?: string;
  periodo: PeriodoMeta;
  data_inicio: string;
  data_fim: string;
  observacoes?: string;
}

export const TIPO_META_LABELS: Record<TipoMeta, string> = {
  vendas: "Vendas",
  tarefas: "Tarefas",
  projetos: "Projetos",
  atendimentos: "Atendimentos",
  outro: "Outro",
};

export const PERIODO_META_LABELS: Record<PeriodoMeta, string> = {
  diario: "Diário",
  semanal: "Semanal",
  mensal: "Mensal",
  trimestral: "Trimestral",
  anual: "Anual",
};
