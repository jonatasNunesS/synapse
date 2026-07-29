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

// ── Kanban da equipe ─────────────────────────────────────────────────────────

export type PrioridadeTarefa = "baixa" | "media" | "alta" | "urgente";
export type OrigemTarefa = "pessoal" | "projeto";

export interface ColunaKanban {
  id: string;
  nome: string;
  ordem: number;
  cor: string;
  criado_em: string;
}

export interface ResponsavelResumo {
  id: string;
  nome: string;
  avatar_url: string;
}

/** Card unificado do board consolidado (tarefa pessoal ou de projeto). */
export interface TarefaKanban {
  id: string;
  origem: OrigemTarefa;
  titulo: string;
  descricao: string;
  prioridade: PrioridadeTarefa;
  prazo: string | null;
  esta_atrasada: boolean;
  coluna_id: string;
  ordem: number;
  responsavel: ResponsavelResumo | null;
  read_only: boolean;
  projeto_id: string | null;
  projeto_nome: string | null;
}

export interface ColunaKanbanComTarefas {
  id: string;
  nome: string;
  ordem: number;
  cor: string;
  tarefas: TarefaKanban[];
}

export interface KanbanConsolidado {
  colunas: ColunaKanbanComTarefas[];
}

export interface TarefaPessoalFormData {
  coluna: string;
  titulo: string;
  descricao?: string;
  responsavel: string;
  prazo?: string | null;
  prioridade: "baixa" | "media" | "alta";
}

export interface ColunaFormData {
  nome: string;
  cor?: string;
}

export const PRIORIDADE_TAREFA_LABELS: Record<PrioridadeTarefa, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

export const PRIORIDADE_TAREFA_CORES: Record<PrioridadeTarefa, string> = {
  baixa: "bg-slate-500/20 text-slate-300",
  media: "bg-blue-500/20 text-blue-300",
  alta: "bg-amber-500/20 text-amber-300",
  urgente: "bg-red-500/20 text-red-300",
};
