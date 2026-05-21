/**
 * Synapse — M6: Tipos do módulo Projetos e Tarefas
 */

// ── Enums ──────────────────────────────────────────────────

export type ProjetoStatus =
  | "planejamento"
  | "em_andamento"
  | "pausado"
  | "concluido"
  | "cancelado";

export type TarefaStatus = "a_fazer" | "em_andamento" | "revisao" | "concluido";

export type Prioridade = "baixa" | "media" | "alta" | "urgente";

// ── Checklist ─────────────────────────────────────────────

export interface ChecklistItem {
  id: string;
  texto: string;
  concluido: boolean;
  ordem: number;
}

// ── Comentário ────────────────────────────────────────────

export interface Comentario {
  id: string;
  texto: string;
  autor_nome: string;
  autor_avatar: string | null;
  editado: boolean;
  criado_em: string;
  atualizado_em: string;
}

// ── Tarefa ────────────────────────────────────────────────

export interface TarefaList {
  id: string;
  projeto_id: string;
  projeto_nome: string;
  titulo: string;
  status: TarefaStatus;
  prioridade: Prioridade;
  responsavel_nome: string | null;
  responsavel_avatar: string | null;
  data_prazo: string | null;
  esta_atrasada: boolean;
  dias_restantes: number | null;
  ordem: number;
  estimativa_horas: string | null;
  horas_gastas: string;
}

export interface TarefaDetail extends TarefaList {
  descricao: string;
  data_conclusao: string | null;
  criado_por_nome: string | null;
  criado_em: string;
  atualizado_em: string;
  comentarios: Comentario[];
  checklist: ChecklistItem[];
}

export interface TarefaCreatePayload {
  titulo: string;
  descricao?: string;
  status?: TarefaStatus;
  prioridade?: Prioridade;
  responsavel?: string | null;
  data_prazo?: string | null;
  ordem?: number;
  estimativa_horas?: string | null;
}

export interface TarefaMoverPayload {
  status: TarefaStatus;
  ordem?: number;
}

// ── Projeto ───────────────────────────────────────────────

export interface ProjetoList {
  id: string;
  nome: string;
  status: ProjetoStatus;
  prioridade: Prioridade;
  responsavel_nome: string | null;
  responsavel_avatar: string | null;
  data_inicio: string | null;
  data_prazo: string | null;
  data_conclusao: string | null;
  progresso: number;
  total_tarefas: number;
  tarefas_concluidas: number;
  esta_atrasado: boolean;
  dias_restantes: number | null;
  cor: string;
  criado_em: string;
}

export interface ProjetoDetail extends ProjetoList {
  descricao: string;
  criado_por_nome: string | null;
  atualizado_em: string;
  tarefas_por_status: {
    a_fazer: TarefaList[];
    em_andamento: TarefaList[];
    revisao: TarefaList[];
    concluido: TarefaList[];
  };
  membros: Array<{ id: string; nome: string }>;
  total_comentarios: number;
}

export interface ProjetoCreatePayload {
  nome: string;
  descricao?: string;
  status?: ProjetoStatus;
  prioridade?: Prioridade;
  responsavel?: string | null;
  data_inicio?: string | null;
  data_prazo?: string | null;
  cor?: string;
}

// ── Kanban ────────────────────────────────────────────────

export interface KanbanData {
  a_fazer: TarefaList[];
  em_andamento: TarefaList[];
  revisao: TarefaList[];
  concluido: TarefaList[];
  totais: Record<TarefaStatus, number>;
}

// ── Resumo ────────────────────────────────────────────────

export interface ResumoProjetosData {
  total_projetos: number;
  projetos_ativos: number;
  projetos_atrasados: number;
  tarefas_pendentes: number;
  tarefas_minhas: number;
  tarefas_atrasadas: number;
  projetos_por_status: Record<ProjetoStatus, number>;
}

// ── Labels e Cores ────────────────────────────────────────

export const PROJETO_STATUS_LABELS: Record<ProjetoStatus, string> = {
  planejamento: "Planejamento",
  em_andamento: "Em Andamento",
  pausado: "Pausado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export const TAREFA_STATUS_LABELS: Record<TarefaStatus, string> = {
  a_fazer: "A Fazer",
  em_andamento: "Em Andamento",
  revisao: "Revisão",
  concluido: "Concluído",
};

export const PRIORIDADE_LABELS: Record<Prioridade, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

export const PRIORIDADE_COLORS: Record<Prioridade, string> = {
  baixa: "bg-gray-100 text-gray-700",
  media: "bg-blue-100 text-blue-700",
  alta: "bg-orange-100 text-orange-700",
  urgente: "bg-red-100 text-red-700",
};

export const PROJETO_STATUS_COLORS: Record<ProjetoStatus, string> = {
  planejamento: "bg-gray-100 text-gray-700",
  em_andamento: "bg-blue-100 text-blue-700",
  pausado: "bg-yellow-100 text-yellow-700",
  concluido: "bg-green-100 text-green-700",
  cancelado: "bg-red-100 text-red-700",
};

export const TAREFA_STATUS_COLORS: Record<TarefaStatus, string> = {
  a_fazer: "bg-gray-100 text-gray-700",
  em_andamento: "bg-blue-100 text-blue-700",
  revisao: "bg-yellow-100 text-yellow-700",
  concluido: "bg-green-100 text-green-700",
};

export const KANBAN_COLUMNS: Array<{ key: TarefaStatus; label: string; color: string }> = [
  { key: "a_fazer", label: "A Fazer", color: "border-gray-300" },
  { key: "em_andamento", label: "Em Andamento", color: "border-blue-400" },
  { key: "revisao", label: "Revisão", color: "border-yellow-400" },
  { key: "concluido", label: "Concluído", color: "border-green-400" },
];
