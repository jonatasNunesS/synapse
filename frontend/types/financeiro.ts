/**
 * Synapse — Tipos do Módulo Financeiro
 */

// ── Categoria ─────────────────────────────────────────────

export type TipoFinanceiro = "receita" | "despesa";

export type StatusLancamento = "pendente" | "pago" | "atrasado" | "cancelado";

export type TipoRecorrencia = "semanal" | "mensal" | "anual";

export interface Categoria {
  id: string;
  nome: string;
  tipo: TipoFinanceiro;
  cor: string;
  icone: string;
  ativo: boolean;
  criado_em: string;
}

export interface CategoriaCreate {
  nome: string;
  tipo: TipoFinanceiro;
  cor?: string;
  icone?: string;
}

// ── Lançamento ────────────────────────────────────────────

export interface Lancamento {
  id: string;
  tipo: TipoFinanceiro;
  descricao: string;
  valor: number;
  categoria: string | null;
  categoria_nome: string | null;
  categoria_cor: string | null;
  data_vencimento: string;
  data_pagamento: string | null;
  status: StatusLancamento;
  recorrente: boolean;
  recorrencia: TipoRecorrencia | "";
  observacoes: string;
  esta_atrasado: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface LancamentoCreate {
  tipo: TipoFinanceiro;
  descricao: string;
  valor: number | string;
  categoria?: string | null;
  data_vencimento: string;
  data_pagamento?: string | null;
  status?: StatusLancamento;
  recorrente?: boolean;
  recorrencia?: TipoRecorrencia | "";
  observacoes?: string;
}

export interface LancamentoPagar {
  data_pagamento: string;
}

// ── Filtros ───────────────────────────────────────────────

export interface FiltrosLancamento {
  tipo?: TipoFinanceiro | "";
  status?: StatusLancamento | "";
  categoria_id?: string;
  data_inicio?: string;
  data_fim?: string;
  busca?: string;
  page?: number;
}

// ── Resumo ────────────────────────────────────────────────

export interface ResumoFinanceiro {
  total_receitas: number;
  total_despesas: number;
  saldo: number;
  total_pendente: number;
  total_atrasado: number;
  lancamentos_count: number;
}

// ── Fluxo de Caixa ────────────────────────────────────────

export interface FluxoCaixaDia {
  data: string;
  receitas: number;
  despesas: number;
  saldo: number;
}

// ── DRE ───────────────────────────────────────────────────

export interface DRECategoria {
  categoria_id: string | null;
  categoria: string;
  cor: string;
  total: number;
}

export interface DRE {
  receitas_por_categoria: DRECategoria[];
  despesas_por_categoria: DRECategoria[];
  total_receitas: number;
  total_despesas: number;
  lucro_bruto: number;
  margem: number;
}
