/**
 * Synapse — Tipos da Análise Financeira (AI Hub 2.0)
 */

export interface NumeroChave {
  label: string;
  valor: string; // já formatado em R$ pelo backend
  variacao: string | null; // ex: "+12.5%", "3 conta(s)", ou null
}

export interface PeriodoRef {
  mes: number;
  ano: number;
  label: string;
}

export interface AnaliseFinanceira {
  periodo: {
    mes: number;
    ano: number;
    label: string;
    label_anterior: string;
  };
  comparacao?: PeriodoRef;
  comparativo?: boolean;
  numeros_chave: NumeroChave[];
  numeros_chave_comparacao?: NumeroChave[];
  diagnostico: string;
  recomendacoes: string[];
  modelo: string;
  gerado_em: string;
}

// Resposta do POST /api/ai/analise-financeira/
export type SolicitarAnaliseResposta =
  | { status: "sem_dados"; message: string }
  | { status: "concluido"; analise: AnaliseFinanceira }
  | { status: "processando"; task_id: string };

// Item de GET /api/ai/analise-financeira/meses/
export interface MesComDados {
  mes: number;
  ano: number;
  label: string;
}

// Seleção de período nos seletores (mes+ano); null = padrão do backend
export interface PeriodoSelecao {
  mes: number;
  ano: number;
}
