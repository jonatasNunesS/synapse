/**
 * Synapse — Tipos da Análise Financeira (AI Hub 2.0)
 */

export interface NumeroChave {
  label: string;
  valor: string; // já formatado em R$ pelo backend
  variacao: string | null; // ex: "+12.5%", "3 conta(s)", ou null
}

export interface AnaliseFinanceira {
  periodo: {
    mes: number;
    ano: number;
    label: string;
    label_anterior: string;
  };
  numeros_chave: NumeroChave[];
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
