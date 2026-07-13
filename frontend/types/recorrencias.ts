/**
 * Synapse — Tipos das Recorrências Inteligentes.
 */

export type TipoRecorrencia = "receita" | "despesa";
export type FrequenciaTipo = "mensal" | "semanal" | "diario";
export type StatusOcorrencia =
  | "pendente"
  | "confirmada"
  | "adiada"
  | "cancelada"
  | "encerrada";

export interface OcorrenciaResumo {
  id: string;
  data_esperada: string;
  status: StatusOcorrencia;
  valor_confirmado: string | null;
  data_confirmacao: string | null;
  data_adiada_para: string | null;
  lancamento_gerado: string | null;
  criada_em: string;
}

export interface Recorrencia {
  id: string;
  titulo: string;
  tipo: TipoRecorrencia;
  valor_padrao: string;
  categoria: string | null;
  categoria_nome: string | null;
  descricao: string;
  ativa: boolean;
  frequencia_tipo: FrequenciaTipo;
  dia_referencia: number;
  usa_dia_util: boolean;
  avisar_com_antecedencia: number;
  ultimas_ocorrencias: OcorrenciaResumo[];
  proxima_prevista: string | null;
  criado_em: string;
}

export interface RecorrenciaFormData {
  titulo: string;
  tipo: TipoRecorrencia;
  valor_padrao: string;
  categoria?: string | null;
  descricao?: string;
  frequencia_tipo: FrequenciaTipo;
  dia_referencia: number;
  usa_dia_util: boolean;
  avisar_com_antecedencia: number;
}

// Ocorrência detalhada (usada no modal de decisão do sino)
export interface OcorrenciaDetalhe {
  id: string;
  recorrencia: string;
  recorrencia_titulo: string;
  recorrencia_tipo: TipoRecorrencia;
  valor_esperado: string;
  data_esperada: string;
  status: StatusOcorrencia;
  valor_confirmado: string | null;
  data_confirmacao: string | null;
  data_adiada_para: string | null;
  lancamento_gerado: string | null;
}

export const DIAS_SEMANA = [
  { value: 0, label: "Segunda" },
  { value: 1, label: "Terça" },
  { value: 2, label: "Quarta" },
  { value: 3, label: "Quinta" },
  { value: 4, label: "Sexta" },
  { value: 5, label: "Sábado" },
  { value: 6, label: "Domingo" },
];

export function descreverFrequencia(r: Recorrencia): string {
  if (r.frequencia_tipo === "diario") return "Diária";
  if (r.frequencia_tipo === "semanal") {
    const d = DIAS_SEMANA.find((x) => x.value === r.dia_referencia);
    return `Toda ${d?.label ?? "semana"}`;
  }
  return `Mensal, dia ${r.dia_referencia}`;
}
