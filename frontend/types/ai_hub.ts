/**
 * Synapse - AI Hub Types (M9)
 */

export type TipoConteudo =
  | "legenda_instagram"
  | "legenda_facebook"
  | "legenda_linkedin"
  | "email_marketing"
  | "descricao_produto"
  | "proposta_comercial"
  | "relatorio_negocio"
  | "insight";

export type StatusTask = "pendente" | "processando" | "concluido" | "erro";

export interface ConteudoGerado {
  id: string;
  tipo: TipoConteudo;
  tipo_display: string;
  prompt_usuario: string;
  resultado: string;
  modelo_usado: string;
  tokens_usados: number;
  favorito: boolean;
  criado_em: string;
}

export interface TaskIA {
  id: string;
  tipo: string;
  status: StatusTask;
  parametros: Record<string, string>;
  resultado: string | null;
  erro: string | null;
  task_id: string | null;
  criado_em: string;
  concluido_em: string | null;
}

export interface UsoIA {
  usado: number;
  limite: number;
  percentual: number;
  plano: string;
  resetar_em: string;
  ilimitado: boolean;
}

export interface SolicitacaoConteudo {
  tipo: TipoConteudo;
  parametros: Record<string, string>;
}

// Parâmetros por tipo de conteúdo
export interface ParametrosLegenda {
  produto_servico: string;
  tom?: string;
  hashtags?: string;
}

export interface ParametrosEmail {
  assunto: string;
  objetivo: string;
  publico_alvo?: string;
}

export interface ParametrosDescricaoProduto {
  nome_produto: string;
  caracteristicas?: string;
  publico_alvo?: string;
}

export interface ParametrosProposta {
  cliente: string;
  servico_produto: string;
  valor?: string;
  prazo?: string;
}

// Labels amigáveis para exibição
export const TIPO_CONTEUDO_LABELS: Record<TipoConteudo, string> = {
  legenda_instagram: "Legenda Instagram",
  legenda_facebook: "Legenda Facebook",
  legenda_linkedin: "Post LinkedIn",
  email_marketing: "E-mail Marketing",
  descricao_produto: "Descrição de Produto",
  proposta_comercial: "Proposta Comercial",
  relatorio_negocio: "Relatório do Negócio",
  insight: "Insight Semanal",
};

export const TIPO_CONTEUDO_ICONE: Record<TipoConteudo, string> = {
  legenda_instagram: "📸",
  legenda_facebook: "👍",
  legenda_linkedin: "💼",
  email_marketing: "📧",
  descricao_produto: "🏷️",
  proposta_comercial: "📋",
  relatorio_negocio: "📊",
  insight: "💡",
};

// Campos obrigatórios por tipo
export const CAMPOS_OBRIGATORIOS: Record<TipoConteudo, { key: string; label: string; placeholder: string }[]> = {
  legenda_instagram: [
    { key: "produto_servico", label: "Produto ou Serviço", placeholder: "Ex: Tênis Nike Air Max" },
    { key: "tom", label: "Tom da mensagem", placeholder: "Ex: Descontraído, profissional, urgente..." },
    { key: "hashtags", label: "Hashtags (opcional)", placeholder: "Ex: corrida, fitness, nike" },
  ],
  legenda_facebook: [
    { key: "produto_servico", label: "Produto ou Serviço", placeholder: "Ex: Promoção de verão" },
    { key: "tom", label: "Tom da mensagem", placeholder: "Ex: Amigável, persuasivo..." },
  ],
  legenda_linkedin: [
    { key: "produto_servico", label: "Tema ou Produto", placeholder: "Ex: Lançamento de software" },
    { key: "tom", label: "Tom profissional", placeholder: "Ex: Inovador, liderança, resultados..." },
  ],
  email_marketing: [
    { key: "assunto", label: "Assunto do e-mail", placeholder: "Ex: Oferta exclusiva para você!" },
    { key: "objetivo", label: "Objetivo", placeholder: "Ex: Vender produto X, reativar cliente..." },
    { key: "publico_alvo", label: "Público-alvo", placeholder: "Ex: Clientes inativos há 30 dias" },
  ],
  descricao_produto: [
    { key: "nome_produto", label: "Nome do Produto", placeholder: "Ex: Camiseta Polo Premium" },
    { key: "caracteristicas", label: "Características", placeholder: "Ex: Algodão 100%, lavável, 3 cores" },
    { key: "publico_alvo", label: "Público-alvo", placeholder: "Ex: Homens 25-40 anos" },
  ],
  proposta_comercial: [
    { key: "cliente", label: "Nome do Cliente/Empresa", placeholder: "Ex: Empresa ABC Ltda" },
    { key: "servico_produto", label: "Serviço ou Produto", placeholder: "Ex: Consultoria de Marketing Digital" },
    { key: "valor", label: "Valor (opcional)", placeholder: "Ex: R$ 2.500/mês" },
    { key: "prazo", label: "Prazo (opcional)", placeholder: "Ex: 3 meses" },
  ],
  relatorio_negocio: [],
  insight: [],
};
