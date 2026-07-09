"use client";
/**
 * AI Hub — porta de entrada por ÁREAS.
 * v1: Análise Financeira (nova) + Gerar Conteúdo (existente). Estrutura
 * dirigida por array — adicionar novas áreas (Estoque, CRM, Eventos) é só
 * incluir um item aqui.
 */
import Link from "next/link";
import {
  Sparkles,
  History,
  LineChart,
  PenLine,
  Package,
  Users,
  ArrowRight,
} from "lucide-react";
import { CreditosBadge } from "@/components/ai_hub/CreditosBadge";

interface AreaAI {
  key: string;
  titulo: string;
  descricao: string;
  icon: React.ElementType;
  href?: string;
  destaque?: boolean;
  badge?: string;
  emBreve?: boolean;
}

const AREAS: AreaAI[] = [
  {
    key: "analise_financeira",
    titulo: "Análise Financeira",
    descricao:
      "A IA analisa os números reais do seu mês — receita, despesa, atrasados — e devolve diagnóstico e recomendações acionáveis.",
    icon: LineChart,
    href: "/ai-hub/analise-financeira",
    destaque: true,
    badge: "Novo",
  },
  {
    key: "conteudo",
    titulo: "Gerar Conteúdo",
    descricao:
      "Legendas, títulos, descrições, e-mails e hashtags para o marketing do seu negócio.",
    icon: PenLine,
    href: "/ai-hub/conteudo",
  },
  {
    key: "estoque",
    titulo: "Análise de Estoque",
    descricao: "Giro, rupturas e sugestões de compra a partir do seu estoque.",
    icon: Package,
    emBreve: true,
  },
  {
    key: "crm",
    titulo: "Análise de CRM",
    descricao: "Funil, oportunidades e follow-ups com base na sua carteira.",
    icon: Users,
    emBreve: true,
  },
];

export default function AIHubPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            AI Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Inteligência sobre os dados do seu negócio. Escolha uma área para começar.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CreditosBadge />
          <Link
            href="/ai-hub/historico"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-accent transition-colors"
          >
            <History className="h-4 w-4" />
            Histórico
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {AREAS.map((area) => {
          const Icon = area.icon;
          const conteudo = (
            <div
              className={`h-full rounded-xl border p-5 transition-all ${
                area.emBreve
                  ? "border-border bg-card/50 opacity-60 cursor-not-allowed"
                  : "border-border bg-card hover:border-primary/50 hover:shadow-lg"
              } ${area.destaque ? "ring-1 ring-primary/30" : ""}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                    area.destaque
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                {area.badge && (
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                    {area.badge}
                  </span>
                )}
                {area.emBreve && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    em breve
                  </span>
                )}
              </div>
              <h2 className="text-base font-semibold text-foreground mb-1">
                {area.titulo}
              </h2>
              <p className="text-sm text-muted-foreground">{area.descricao}</p>
              {!area.emBreve && (
                <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Abrir <ArrowRight className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          );

          return area.href ? (
            <Link key={area.key} href={area.href} className="block">
              {conteudo}
            </Link>
          ) : (
            <div key={area.key}>{conteudo}</div>
          );
        })}
      </div>
    </div>
  );
}
