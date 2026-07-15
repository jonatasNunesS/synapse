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
  data_vencimento: string | null;
  data_pagamento?: string | null;
  status?: StatusLancamento;
  recorrente?: boolean;
  recorrencia?: TipoRecorrencia | "";
  observacoes?: string;
}

export interface LancamentoPagar {
  data_pagamento: string;
}

// ── Auditoria de lançamentos pagos ────────────────────────
// Lançamentos pagos são editáveis/excluíveis só por admin, com motivo
// obrigatório; cada operação gera um LogEdicaoLancamento no backend.

export interface SnapshotLancamento {
  id: string;
  tipo: TipoFinanceiro;
  descricao: string;
  valor: string;
  categoria_id: string | null;
  categoria_nome: string | null;
  data_vencimento: string;
  data_pagamento: string | null;
  status: StatusLancamento;
  recorrente: boolean;
  recorrencia: string;
  observacoes: string;
}

export interface LogEdicaoLancamento {
  id: string;
  lancamento: string | null;
  acao: "editado" | "excluido";
  acao_display: string;
  motivo: string;
  editado_por: string | null;
  editado_por_nome: string | null;
  editado_em: string;
  snapshot_antes: SnapshotLancamento;
  snapshot_depois: SnapshotLancamento | null;
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

// ── Saldo (acumulado + do mês + 4 métricas) ───────────────

export interface SaldoMetrica {
  total: number;
  count: number;
}

export interface SaldoFinanceiro {
  acumulado: {
    total_recebido: number;
    total_pago: number;
    saldo: number;
  };
  /** Dinheiro guardado em caixinhas (sai do saldo disponível). */
  caixinhas: {
    total: number;
    quantidade: number;
  };
  /** acumulado.saldo − caixinhas.total */
  saldo_disponivel: number;
  /** = acumulado.saldo (caixinhas não mudam o patrimônio) */
  patrimonio_total: number;
  mes_atual: {
    mes: number;
    ano: number;
    saldo: number;
    recebido: SaldoMetrica;
    a_receber: SaldoMetrica;
    pago: SaldoMetrica;
    a_pagar: SaldoMetrica;
  };
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
