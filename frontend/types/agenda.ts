/**
 * Synapse — Tipos do Módulo Agenda (v1)
 */

export interface Evento {
  id: string;
  titulo: string;
  descricao: string;
  data_inicio: string; // ISO
  data_fim: string; // ISO
  dia_inteiro: boolean;
  local: string;
  cor: string;
  cliente: string | null; // id do Cliente
  cliente_nome: string | null;
  criado_por: string | null;
  criado_por_nome: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface EventoPayload {
  titulo: string;
  descricao?: string;
  data_inicio: string; // ISO
  data_fim: string; // ISO
  dia_inteiro?: boolean;
  local?: string;
  cor?: string;
  cliente?: string | null;
}

// Cores preset para o seletor (mesmo padrão do ProjetoForm)
export const CORES_EVENTO = [
  "#6D28D9", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#0ea5e9", "#64748b",
];
