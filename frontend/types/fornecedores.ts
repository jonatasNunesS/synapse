// M5 — Fornecedores: TypeScript Types

export type StatusFornecedor = "ativo" | "inativo" | "suspenso" | "em_avaliacao";

export interface CategoriaFornecedor {
  id: string;
  nome: string;
  cor: string;
  ativo: boolean;
  criado_em: string;
}

export interface FornecedorList {
  id: string;
  nome: string;
  categoria_nome: string | null;
  categoria_cor: string | null;
  status: StatusFornecedor;
  status_display: string;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  score_synapse: string;
  avaliacao_geral: number | null;
  valor_total_compras: string;
  quantidade_pedidos: number;
  ultima_compra: string | null;
  ativo: boolean;
  link_whatsapp: string | null;
  ticket_medio: string;
}

export interface CompraFornecedor {
  id: string;
  fornecedor: string;
  fornecedor_nome: string;
  descricao: string;
  valor: string;
  data_compra: string;
  numero_nf: string | null;
  status: "pendente" | "pago" | "cancelado";
  status_display: string;
  data_pagamento: string | null;
  observacoes: string | null;
  criado_por_nome: string | null;
  criado_em: string;
}

export interface FornecedorDetail extends FornecedorList {
  nome_contato: string | null;
  site: string | null;
  cnpj: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
  categoria: string | null;
  condicoes_pagamento: string | null;
  prazo_entrega_dias: number | null;
  avaliacao_qualidade: number | null;
  avaliacao_prazo: number | null;
  avaliacao_preco: number | null;
  notas: string | null;
  compras: CompraFornecedor[];
  total_compras: number;
  criado_por_nome: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface RankingFornecedor {
  id: string;
  nome: string;
  categoria_nome: string | null;
  score_synapse: string;
  avaliacao_qualidade: number | null;
  avaliacao_prazo: number | null;
  avaliacao_preco: number | null;
  valor_total_compras: string;
  quantidade_pedidos: number;
  posicao: number;
}

export interface ResumoFornecedores {
  total_fornecedores: number;
  fornecedores_ativos: number;
  valor_total_gasto: string;
  ticket_medio_geral: string;
  melhor_score: {
    id: string;
    nome: string;
    score_synapse: string;
  } | null;
  fornecedores_por_status: Record<string, number>;
}

// Form types
export interface FornecedorFormData {
  nome: string;
  nome_contato?: string;
  email?: string;
  telefone?: string;
  whatsapp?: string;
  site?: string;
  cnpj?: string;
  endereco_cidade?: string;
  endereco_estado?: string;
  categoria?: string;
  status: StatusFornecedor;
  condicoes_pagamento?: string;
  prazo_entrega_dias?: number;
  notas?: string;
}

export interface AvaliacaoFormData {
  avaliacao_qualidade: number;
  avaliacao_prazo: number;
  avaliacao_preco: number;
}

export interface CompraFormData {
  descricao: string;
  valor: number;
  data_compra: string;
  numero_nf?: string;
  status: "pendente" | "pago" | "cancelado";
  data_pagamento?: string;
  observacoes?: string;
}
