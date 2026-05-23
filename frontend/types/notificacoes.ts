// Synapse — M7: Types do módulo Notificações

export type TipoNotificacao =
  | "financeiro"
  | "estoque"
  | "cliente"
  | "fornecedor"
  | "projeto"
  | "equipe"
  | "documento"
  | "sistema";

export type PrioridadeNotificacao = "normal" | "alta" | "urgente";

export interface Notificacao {
  id: string;
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string;
  lida: boolean;
  data_leitura: string | null;
  acao_url: string;
  prioridade: PrioridadeNotificacao;
  criado_em: string;
}

export interface ContagemNotificacoes {
  count: number;
}

export const TIPO_NOTIFICACAO_LABELS: Record<TipoNotificacao, string> = {
  financeiro: "Financeiro",
  estoque: "Estoque",
  cliente: "Cliente",
  fornecedor: "Fornecedor",
  projeto: "Projeto",
  equipe: "Equipe",
  documento: "Documento",
  sistema: "Sistema",
};

export const PRIORIDADE_NOTIFICACAO_COLORS: Record<PrioridadeNotificacao, string> = {
  normal: "text-muted-foreground",
  alta: "text-orange-500",
  urgente: "text-red-500",
};
