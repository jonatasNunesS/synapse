/**
 * Synapse — Tipos dos créditos de IA (AI Hub)
 */
export interface Creditos {
  usado: number;
  limite: number | null;
  restante: number | null;
  plano: string;
  ilimitado: boolean;
  renova_em: string; // ex: "amanhã às 00:00"
  renova_em_iso?: string;
}

// Custo em créditos por operação (espelha o backend, só para exibição)
export const CUSTO_OPERACAO = {
  conteudo: 1,
  analise_financeira: 2,
} as const;
