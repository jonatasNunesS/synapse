/**
 * Synapse — Tipos do Módulo Agenda
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
  /** Minutos antes do início para avisar. 0 = sem lembrete. */
  lembrete_antecedencia: number;
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
  lembrete_antecedencia?: number;
  cliente?: string | null;
}

/**
 * Antecedências do lembrete, em minutos. Espelha LEMBRETE_CHOICES do backend
 * (`modules/agenda/models.py`) — se mudar lá, muda aqui.
 * Zero é o default: quem não pediu lembrete não recebe lembrete.
 */
export const SEM_LEMBRETE = 0;

export const LEMBRETES: { valor: number; label: string }[] = [
  { valor: SEM_LEMBRETE, label: "Sem lembrete" },
  { valor: 10, label: "10 minutos antes" },
  { valor: 30, label: "30 minutos antes" },
  { valor: 60, label: "1 hora antes" },
  { valor: 1440, label: "1 dia antes" },
];

/** Rótulo da antecedência, para exibir no detalhe do evento. */
export function rotuloLembrete(minutos: number): string {
  return LEMBRETES.find((l) => l.valor === minutos)?.label ?? `${minutos} min antes`;
}

// Cores preset para o seletor (mesmo padrão do ProjetoForm)
export const CORES_EVENTO = [
  "#6D28D9", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#0ea5e9", "#64748b",
];
