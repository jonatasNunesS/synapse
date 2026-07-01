/**
 * Synapse - AI Hub Types (M9)
 */

// Tipos aceitos pelo backend (TIPO_CONTEUDO_CHOICES em modules/ai_hub/models.py)
export type TipoConteudo =
  | "legenda_instagram"
  | "titulo_produto"
  | "descricao_produto"
  | "hashtags"
  | "ideia_pauta"
  | "email_marketing"
  | "relatorio_negocio"
  | "insight"
  | "outro";

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

// Labels amigáveis para exibição
export const TIPO_CONTEUDO_LABELS: Record<TipoConteudo, string> = {
  legenda_instagram: "Legenda Instagram",
  titulo_produto: "Título de Produto",
  descricao_produto: "Descrição de Produto",
  hashtags: "Hashtags",
  ideia_pauta: "Ideia de Pauta",
  email_marketing: "E-mail Marketing",
  relatorio_negocio: "Relatório do Negócio",
  insight: "Insight Semanal",
  outro: "Pedido Livre",
};

export const TIPO_CONTEUDO_ICONE: Record<TipoConteudo, string> = {
  legenda_instagram: "📸",
  titulo_produto: "🏷️",
  descricao_produto: "📝",
  hashtags: "#️⃣",
  ideia_pauta: "💭",
  email_marketing: "📧",
  relatorio_negocio: "📊",
  insight: "💡",
  outro: "✨",
};

// Campos por tipo — keys DEVEM bater com CAMPOS_OBRIGATORIOS do backend
// (modules/ai_hub/serializers.py) e com os templates de prompt (tasks.py)
export const CAMPOS_OBRIGATORIOS: Record<TipoConteudo, { key: string; label: string; placeholder: string }[]> = {
  legenda_instagram: [
    { key: "produto", label: "Produto ou Serviço", placeholder: "Ex: Tênis Nike Air Max" },
    { key: "tom", label: "Tom da mensagem", placeholder: "Ex: Descontraído, profissional, urgente..." },
    { key: "quantidade", label: "Quantidade de legendas", placeholder: "Ex: 3" },
  ],
  titulo_produto: [
    { key: "produto", label: "Produto", placeholder: "Ex: Camiseta Polo Premium" },
    { key: "plataforma", label: "Plataforma", placeholder: "Ex: Mercado Livre, Shopee, loja própria..." },
    { key: "quantidade", label: "Quantidade de títulos", placeholder: "Ex: 5" },
  ],
  descricao_produto: [
    { key: "produto", label: "Nome do Produto", placeholder: "Ex: Camiseta Polo Premium" },
    { key: "publico", label: "Público-alvo", placeholder: "Ex: Homens 25-40 anos" },
    { key: "diferenciais", label: "Diferenciais", placeholder: "Ex: Algodão 100%, lavável, 3 cores" },
  ],
  hashtags: [
    { key: "tema", label: "Tema", placeholder: "Ex: Moda fitness feminina" },
    { key: "quantidade", label: "Quantidade de hashtags", placeholder: "Ex: 15" },
  ],
  ideia_pauta: [
    { key: "plataforma", label: "Plataforma", placeholder: "Ex: Instagram, TikTok, blog..." },
    { key: "quantidade", label: "Quantidade de ideias", placeholder: "Ex: 5" },
  ],
  email_marketing: [
    { key: "assunto", label: "Assunto do e-mail", placeholder: "Ex: Oferta exclusiva para você!" },
    { key: "objetivo", label: "Objetivo", placeholder: "Ex: Vender produto X, reativar cliente..." },
  ],
  relatorio_negocio: [],
  insight: [],
  outro: [
    { key: "descricao", label: "O que você precisa?", placeholder: "Descreva livremente o conteúdo que a IA deve gerar..." },
  ],
};
