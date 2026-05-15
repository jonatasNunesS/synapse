// ─── Tipos do Módulo de Estoque ───────────────────────────────────────────────

export type UnidadeEstoque =
  | "unidade"
  | "kg"
  | "g"
  | "litro"
  | "ml"
  | "metro"
  | "cm"
  | "caixa"
  | "pacote"
  | "par";

export type StatusEstoque = "ok" | "baixo" | "zerado";

export type TipoMovimentacao = "entrada" | "saida" | "ajuste";

export type MotivoMovimentacao =
  | "compra"
  | "venda"
  | "devolucao_compra"
  | "devolucao_venda"
  | "ajuste_manual"
  | "perda"
  | "transferencia"
  | "producao"
  | "consumo_interno";

// ─── Categoria de Estoque ─────────────────────────────────────────────────────

export interface CategoriaEstoque {
  id: string;
  nome: string;
  descricao: string;
  cor: string;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface CategoriaEstoqueCreate {
  nome: string;
  descricao?: string;
  cor?: string;
}

// ─── Variação ─────────────────────────────────────────────────────────────────

export interface Variacao {
  id: string;
  nome: string;
  sku_variacao: string;
  estoque_atual: number;
  preco_venda: number | null;
  ativo: boolean;
}

// ─── Produto ──────────────────────────────────────────────────────────────────

export interface ProdutoList {
  id: string;
  nome: string;
  sku: string;
  categoria_nome: string | null;
  categoria_cor: string | null;
  preco_venda: number;
  estoque_atual: number;
  estoque_minimo: number;
  status_estoque: StatusEstoque;
  unidade: UnidadeEstoque;
  imagem_url: string;
  ativo: boolean;
}

export interface ProdutoDetail extends ProdutoList {
  descricao: string;
  codigo_barras: string;
  preco_custo: number;
  estoque_maximo: number | null;
  categoria: string | null;
  variacoes: Variacao[];
  margem_lucro: number | null;
  esta_abaixo_minimo: boolean;
  esta_sem_estoque: boolean;
  valor_em_estoque: number;
  total_movimentacoes: number;
  criado_por_nome: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface ProdutoCreate {
  nome: string;
  descricao?: string;
  sku?: string;
  codigo_barras?: string;
  unidade?: UnidadeEstoque;
  preco_custo?: number;
  preco_venda?: number;
  estoque_minimo?: number;
  estoque_maximo?: number | null;
  categoria?: string | null;
  imagem_url?: string;
}

// ─── Movimentação ─────────────────────────────────────────────────────────────

export interface Movimentacao {
  id: string;
  produto: {
    id: string;
    nome: string;
    sku: string;
    estoque_atual: number;
    unidade: UnidadeEstoque;
  };
  variacao: Variacao | null;
  tipo: TipoMovimentacao;
  quantidade: number;
  estoque_antes: number;
  estoque_depois: number;
  motivo: MotivoMovimentacao;
  referencia: string;
  observacoes: string;
  criado_por_nome: string | null;
  criado_em: string;
}

export interface MovimentacaoCreate {
  produto: string;
  variacao?: string | null;
  tipo: TipoMovimentacao;
  quantidade: number;
  motivo: MotivoMovimentacao;
  referencia?: string;
  observacoes?: string;
}

// ─── Resumo e Alertas ─────────────────────────────────────────────────────────

export interface ResumoEstoque {
  total_produtos: number;
  total_skus: number;
  valor_total_estoque: number;
  produtos_sem_estoque: number;
  produtos_abaixo_minimo: number;
  giro_medio: number;
}

export interface RelatorioEstoque {
  total_produtos: number;
  total_skus: number;
  valor_total_estoque: number;
  produtos_sem_estoque: number;
  produtos_abaixo_minimo: number;
  giro_medio: number;
}

// ─── Filtros ──────────────────────────────────────────────────────────────────

export interface FiltrosProduto {
  busca?: string;
  categoria?: string;
  status_estoque?: StatusEstoque | "";
  ativo?: boolean;
  ordering?: string;
  page?: number;
}

export interface FiltrosMovimentacao {
  tipo?: TipoMovimentacao | "";
  motivo?: MotivoMovimentacao | "";
  data_inicio?: string;
  data_fim?: string;
  page?: number;
}
