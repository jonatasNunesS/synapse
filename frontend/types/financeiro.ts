/**
 * Synapse — Tipos do Módulo Financeiro
 */

// ── Categoria ─────────────────────────────────────────────

export type TipoFinanceiro = "receita" | "despesa" | "emprestimo";

// Categorias existem só para receita/despesa (empréstimo não usa categoria).
export type TipoCategoria = "receita" | "despesa";

export type DirecaoEmprestimo = "emprestei" | "peguei_emprestado";

export type StatusEmprestimo = "aberto" | "atrasado" | "quitado" | "perdoado" | "";

export type StatusLancamento = "pendente" | "pago" | "atrasado" | "cancelado";

export type TipoRecorrencia = "semanal" | "mensal" | "anual";

export interface Categoria {
  id: string;
  nome: string;
  tipo: TipoCategoria;
  cor: string;
  icone: string;
  ativo: boolean;
  criado_em: string;
}

export interface CategoriaCreate {
  nome: string;
  tipo: TipoCategoria;
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
  // Campos de empréstimo (preenchidos só quando tipo="emprestimo")
  direcao_emprestimo: DirecaoEmprestimo | null;
  direcao_emprestimo_display: string | null;
  pessoa_emprestimo: string | null;
  data_retorno_esperado: string | null;
  emprestimo_quitado: boolean;
  emprestimo_perdoado: boolean;
  data_quitacao: string | null;
  status_emprestimo: StatusEmprestimo;
  criado_em: string;
  atualizado_em: string;
}

export interface LancamentoCreate {
  tipo: TipoFinanceiro;
  descricao: string;
  valor: number | string;
  categoria?: string | null;
  data_vencimento?: string | null;
  data_pagamento?: string | null;
  status?: StatusLancamento;
  recorrente?: boolean;
  recorrencia?: TipoRecorrencia | "";
  observacoes?: string;
  // Empréstimo
  direcao_emprestimo?: DirecaoEmprestimo | null;
  pessoa_emprestimo?: string | null;
  data_retorno_esperado?: string | null;
}

export interface ResumoEmprestimos {
  a_receber: number;
  a_devolver: number;
  quantidade: number;
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
  // Contexto de empréstimos abertos (o saldo já reflete o efeito de caixa).
  emprestimos?: {
    a_receber: number;
    a_devolver: number;
    quantidade: number;
  };
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
