// Synapse — M7: Types do módulo Documentos

export type TipoDocumento =
  | "contrato"
  | "proposta"
  | "relatorio"
  | "ata"
  | "manual"
  | "politica"
  | "outro";

export type StatusDocumento = "rascunho" | "em_revisao" | "aprovado" | "arquivado";

export interface VersaoDocumento {
  id: string;
  numero_versao: number;
  arquivo: string | null;
  notas: string;
  criado_por_nome: string | null;
  criado_em: string;
}

export interface Documento {
  id: string;
  titulo: string;
  descricao: string;
  tipo: TipoDocumento;
  status: StatusDocumento;
  arquivo: string | null;
  url_externa: string;
  tags: string[];
  total_versoes: number;
  versoes?: VersaoDocumento[];
  criado_por_nome: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface DocumentoFormData {
  titulo: string;
  descricao?: string;
  tipo: TipoDocumento;
  status: StatusDocumento;
  url_externa?: string;
  tags?: string[];
}

export const TIPO_DOCUMENTO_LABELS: Record<TipoDocumento, string> = {
  contrato: "Contrato",
  proposta: "Proposta",
  relatorio: "Relatório",
  ata: "Ata de Reunião",
  manual: "Manual",
  politica: "Política",
  outro: "Outro",
};

export const STATUS_DOCUMENTO_LABELS: Record<StatusDocumento, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em Revisão",
  aprovado: "Aprovado",
  arquivado: "Arquivado",
};

export const STATUS_DOCUMENTO_COLORS: Record<StatusDocumento, string> = {
  rascunho: "secondary",
  em_revisao: "outline",
  aprovado: "default",
  arquivado: "secondary",
};
