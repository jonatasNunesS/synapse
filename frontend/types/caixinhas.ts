// ── Caixinhas (reservas financeiras, modelo Nubank) ──────────
// Dinheiro depositado sai do saldo disponível; retirado, volta.
// saldo_disponivel = saldo_acumulado − total_em_caixinhas.

export interface Caixinha {
  id: string;
  nome: string;
  cor: string;
  icone: string;
  saldo: string;
  meta: string | null;
  meta_atingida: boolean;
  /** saldo/meta em % (0–100, capado). null se não há meta. */
  progresso: number | null;
  criado_em: string;
  atualizado_em: string;
}

export interface CaixinhaCreate {
  nome: string;
  cor?: string;
  icone?: string;
  meta?: string | null;
}

export interface MovimentoCaixinha {
  id: string;
  tipo: "deposito" | "retirada";
  tipo_display: string;
  valor: string;
  descricao: string;
  criado_por_nome: string | null;
  criado_em: string;
}

export interface ResumoCaixinhas {
  total: number;
  quantidade: number;
}
