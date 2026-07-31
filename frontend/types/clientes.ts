// ─── Tipos base ──────────────────────────────────────────────────────────────

export type TipoCliente = "pessoa_fisica" | "pessoa_juridica";

export type StatusFunil =
  | "lead"
  | "contato"
  | "proposta"
  | "negociacao"
  | "fechado"
  | "perdido";

export type OrigemCliente =
  | "indicacao"
  | "instagram"
  | "facebook"
  | "google"
  | "site"
  | "whatsapp"
  | "outro";

export type TipoInteracao =
  | "ligacao"
  | "email"
  | "reuniao"
  | "whatsapp"
  | "venda"
  | "outro";

// ─── Cliente ─────────────────────────────────────────────────────────────────

export interface ClienteList {
  id: string;
  nome: string;
  tipo: TipoCliente;
  tipo_display: string;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  status_funil: StatusFunil;
  status_funil_display: string;
  origem: OrigemCliente;
  origem_display: string;
  valor_total_compras: string;
  /** Já recebido (vendas pagas). */
  valor_recebido: string;
  /** A receber (vendas pendentes). */
  valor_a_receber: string;
  quantidade_compras: number;
  ultima_compra: string | null;
  proximo_followup: string | null;
  followup_atrasado: boolean;
  link_whatsapp: string | null;
  ativo: boolean;
  criado_em: string;
}

export interface ClienteDetail extends ClienteList {
  cpf_cnpj: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  tags: string[];
  observacoes: string | null;
  ticket_medio: string;
  dias_sem_compra: number | null;
  criado_por_nome: string | null;
  atualizado_em: string;
}

export interface ClienteCreate {
  nome: string;
  tipo: TipoCliente;
  email?: string;
  telefone?: string;
  whatsapp?: string;
  cpf_cnpj?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  origem?: OrigemCliente;
  status_funil?: StatusFunil;
  tags?: string[];
  observacoes?: string;
}

// ─── Interação ───────────────────────────────────────────────────────────────

export type StatusPagamento = "pago" | "pendente" | "cancelado" | "nao_se_aplica";

export interface InteracaoCliente {
  id: string;
  tipo: TipoInteracao;
  tipo_display: string;
  titulo: string;
  descricao: string | null;
  valor: string | null;
  data_interacao: string;
  proximo_followup: string | null;
  status_pagamento: StatusPagamento;
  status_pagamento_display: string;
  data_prevista_pagamento: string | null;
  /** Pendente com data vencida? */
  pagamento_atrasado: boolean;
  /** Dias até a previsão (negativo se venceu; null se não aplicável). */
  dias_para_vencer: number | null;
  criado_por_nome: string | null;
  criado_em: string;
  /** Venda já baixou estoque? */
  ja_baixado_estoque?: boolean;
  /** Venda já virou lançamento financeiro? */
  ja_no_financeiro?: boolean;
  /** Detalhes da movimentação de estoque vinculada (para perguntar no apagar). */
  movimentacao_estoque_info?: MovimentacaoInfo | null;
  /** Detalhes do lançamento financeiro vinculado. */
  lancamento_financeiro_info?: LancamentoInfo | null;
}

export interface MovimentacaoInfo {
  id: string;
  produto_nome: string;
  quantidade: string;
  tipo: string;
}

export interface LancamentoInfo {
  id: string;
  valor: string;
  status: string;
  tipo: string;
}

export interface InteracaoCreate {
  tipo: TipoInteracao;
  titulo: string;
  descricao?: string;
  valor?: string;
  data_interacao?: string;
  proximo_followup?: string;
  status_pagamento?: StatusPagamento;
  data_prevista_pagamento?: string;
}

// ─── Funil Kanban ─────────────────────────────────────────────────────────────

export interface FunilColuna {
  count: number;
  valor_total: string;
}

export interface FunilData {
  lead: ClienteList[];
  contato: ClienteList[];
  proposta: ClienteList[];
  negociacao: ClienteList[];
  fechado: ClienteList[];
  perdido: ClienteList[];
  totais: Record<StatusFunil, FunilColuna>;
}

// ─── Resumo / KPIs ───────────────────────────────────────────────────────────

export interface ResumoClientes {
  total_clientes: number;
  clientes_ativos: number;
  novos_este_mes: number;
  valor_total_vendas: string;
  ticket_medio: string;
  followups_hoje: number;
  followups_atrasados: number;
  por_status: Record<StatusFunil, number>;
  por_origem: Record<string, number>;
  // Presentes só quando há filtro de período (mes/ano):
  periodo?: { mes: number; ano: number; label: string };
  novos_no_periodo?: number;
  valor_gerado_no_periodo?: string;
  comparativo?: {
    novos_mes_anterior: number;
    novos_diff: number;
    mes_anterior_label: string;
  };
}

// ─── Labels de exibição ──────────────────────────────────────────────────────

export const STATUS_FUNIL_LABELS: Record<StatusFunil, string> = {
  lead: "Lead",
  contato: "Contato",
  proposta: "Proposta",
  negociacao: "Negociação",
  fechado: "Fechado",
  perdido: "Perdido",
};

export const STATUS_FUNIL_COLORS: Record<StatusFunil, string> = {
  lead: "bg-slate-500",
  contato: "bg-blue-500",
  proposta: "bg-yellow-500",
  negociacao: "bg-orange-500",
  fechado: "bg-green-500",
  perdido: "bg-red-500",
};

export const TIPO_INTERACAO_LABELS: Record<TipoInteracao, string> = {
  ligacao: "Ligação",
  email: "E-mail",
  reuniao: "Reunião",
  whatsapp: "WhatsApp",
  venda: "Venda",
  outro: "Outro",
};

export const TIPO_INTERACAO_ICONS: Record<TipoInteracao, string> = {
  ligacao: "📞",
  email: "📧",
  reuniao: "🤝",
  whatsapp: "💬",
  venda: "💰",
  outro: "📝",
};
