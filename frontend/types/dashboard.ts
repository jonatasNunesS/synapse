// Synapse — M8 Dashboard: Types

// ════════════════════════════════════════════════════════════
// RESUMO PRINCIPAL
// ════════════════════════════════════════════════════════════

export interface DashboardFinanceiro {
  total_receitas: number;
  total_despesas: number;
  saldo_mes: number;
  total_pendente: number;
  total_atrasado: number;
  lancamentos_count: number;
}

export interface DashboardEstoque {
  total_produtos: number;
  valor_total_estoque: number;
  produtos_sem_estoque: number;
  produtos_abaixo_minimo: number;
  giro_medio: number;
}

export interface DashboardCRM {
  total_clientes: number;
  clientes_ativos: number;
  novos_este_mes: number;
  valor_total_gerado: number;
  ticket_medio_geral: number;
  followups_atrasados: number;
  clientes_por_status: Record<string, number>;
}

export interface DashboardProjetos {
  total_projetos: number;
  projetos_ativos: number;
  projetos_atrasados: number;
  tarefas_pendentes: number;
  tarefas_minhas: number;
  tarefas_atrasadas: number;
  projetos_por_status: Record<string, number>;
}

export interface DashboardEquipe {
  total_membros: number;
  membros_ativos: number;
  por_perfil: Record<string, number>;
  por_departamento: Array<{ departamento: string; count: number }>;
}

export interface DashboardNotificacoes {
  nao_lidas: number;
}

export interface DashboardMeta {
  mes: number;
  ano: number;
  gerado_em: string;
}

export interface DashboardResumo {
  financeiro: DashboardFinanceiro;
  estoque: DashboardEstoque;
  crm: DashboardCRM;
  projetos: DashboardProjetos;
  equipe: DashboardEquipe;
  notificacoes: DashboardNotificacoes;
  meta: DashboardMeta;
}

// ════════════════════════════════════════════════════════════
// FLUXO DE CAIXA
// ════════════════════════════════════════════════════════════

export interface FluxoCaixaDia {
  data: string;
  receitas: number;
  despesas: number;
  saldo: number;
  saldo_acumulado: number;
}

export interface DashboardFluxoCaixa {
  fluxo: FluxoCaixaDia[];
  dias: number;
}

// ════════════════════════════════════════════════════════════
// FUNIL DE VENDAS
// ════════════════════════════════════════════════════════════

export interface FunilEtapa {
  status: string;
  label: string;
  count: number;
  valor_total: number;
  percentual: number;
}

export interface DashboardFunil {
  etapas: FunilEtapa[];
  total_clientes: number;
  total_valor: number;
}

// ════════════════════════════════════════════════════════════
// VENCIMENTOS
// ════════════════════════════════════════════════════════════

export interface VencimentoItem {
  id: string;
  descricao: string;
  valor: number;
  tipo: "receita" | "despesa";
  data_vencimento: string;
  dias_restantes: number;
  status: string;
}

export interface DashboardVencimentos {
  vencimentos: VencimentoItem[];
  dias: number;
}

// ════════════════════════════════════════════════════════════
// FOLLOW-UPS
// ════════════════════════════════════════════════════════════

export interface FollowUpItem {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  proximo_followup: string;
  status_funil: string;
  dias_restantes: number;
}

export interface DashboardFollowUps {
  followups: FollowUpItem[];
  dias: number;
}

// ════════════════════════════════════════════════════════════
// MINHAS TAREFAS
// ════════════════════════════════════════════════════════════

export interface TarefaDashboard {
  id: string;
  titulo: string;
  status: string;
  prioridade: string;
  data_prazo: string | null;
  projeto_id: string;
  projeto_nome: string;
  dias_restantes: number | null;
  atrasada: boolean;
}

export interface DashboardMinhasTarefas {
  tarefas: TarefaDashboard[];
}

// ════════════════════════════════════════════════════════════
// ALERTAS DE ESTOQUE
// ════════════════════════════════════════════════════════════

export interface AlertaEstoqueItem {
  id: string;
  nome: string;
  sku: string;
  estoque_atual: number;
  estoque_minimo: number;
  status_estoque: "zerado" | "critico" | "baixo";
  unidade: string;
}

export interface DashboardAlertasEstoque {
  alertas: AlertaEstoqueItem[];
}

// ════════════════════════════════════════════════════════════
// PROJETOS EM ANDAMENTO
// ════════════════════════════════════════════════════════════

export interface ProjetoDashboard {
  id: string;
  nome: string;
  status: string;
  prioridade: string;
  progresso: number;
  cor: string;
  data_prazo: string | null;
  responsavel_nome: string;
  tarefas_total: number;
  tarefas_concluidas: number;
  atrasado: boolean;
}

export interface DashboardProjetos2 {
  projetos: ProjetoDashboard[];
}

// ════════════════════════════════════════════════════════════
// ATIVIDADE RECENTE
// ════════════════════════════════════════════════════════════

export type AtividadeTipo =
  | "lancamento"
  | "movimentacao"
  | "cliente"
  | "interacao"
  | "tarefa"
  | "projeto"
  | "documento"
  | "membro";

export interface AtividadeEvento {
  tipo: AtividadeTipo;
  titulo: string;
  descricao: string;
  data: string;
  icone: string;
  cor: string;
  link?: string;
}

export interface DashboardAtividade {
  eventos: AtividadeEvento[];
}

// ════════════════════════════════════════════════════════════
// PERÍODO SELECTOR (Analytics)
// ════════════════════════════════════════════════════════════

export type PeriodoAnalytics = "7d" | "30d" | "90d" | "365d";

export interface PeriodoOption {
  value: PeriodoAnalytics;
  label: string;
  dias: number;
}

export const PERIODOS: PeriodoOption[] = [
  { value: "7d", label: "7 dias", dias: 7 },
  { value: "30d", label: "30 dias", dias: 30 },
  { value: "90d", label: "90 dias", dias: 90 },
  { value: "365d", label: "1 ano", dias: 365 },
];

// ════════════════════════════════════════════════════════════
// LABELS E CORES
// ════════════════════════════════════════════════════════════

export const STATUS_FUNIL_LABELS: Record<string, string> = {
  lead: "Lead",
  contato: "Contato",
  proposta: "Proposta",
  negociacao: "Negociação",
  fechado: "Fechado",
  perdido: "Perdido",
};

export const STATUS_FUNIL_CORES: Record<string, string> = {
  lead: "#6366f1",
  contato: "#3b82f6",
  proposta: "#f59e0b",
  negociacao: "#10b981",
  fechado: "#22c55e",
  perdido: "#ef4444",
};

export const PRIORIDADE_CORES: Record<string, string> = {
  baixa: "#6b7280",
  media: "#3b82f6",
  alta: "#f59e0b",
  urgente: "#ef4444",
};

export const ALERTA_ESTOQUE_LABELS: Record<string, string> = {
  zerado: "Sem estoque",
  critico: "Crítico",
  baixo: "Abaixo do mínimo",
};

export const ALERTA_ESTOQUE_CORES: Record<string, string> = {
  zerado: "#ef4444",
  critico: "#f97316",
  baixo: "#f59e0b",
};

export const ATIVIDADE_ICONES: Record<AtividadeTipo, string> = {
  lancamento: "DollarSign",
  movimentacao: "Package",
  cliente: "Users",
  interacao: "MessageSquare",
  tarefa: "CheckSquare",
  projeto: "FolderOpen",
  documento: "FileText",
  membro: "UserPlus",
};

export const ATIVIDADE_CORES: Record<AtividadeTipo, string> = {
  lancamento: "text-green-600 bg-green-50",
  movimentacao: "text-blue-600 bg-blue-50",
  cliente: "text-purple-600 bg-purple-50",
  interacao: "text-indigo-600 bg-indigo-50",
  tarefa: "text-orange-600 bg-orange-50",
  projeto: "text-cyan-600 bg-cyan-50",
  documento: "text-gray-600 bg-gray-50",
  membro: "text-pink-600 bg-pink-50",
};
