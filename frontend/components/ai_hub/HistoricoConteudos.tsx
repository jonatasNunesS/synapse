"use client";

import { useState } from "react";
import { Star, Copy, Check, Filter, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useHistoricoConteudos } from "@/hooks/useAIHub";
import type { TipoConteudo } from "@/types/ai_hub";
import { TIPO_CONTEUDO_LABELS, TIPO_CONTEUDO_ICONE } from "@/types/ai_hub";

const TIPOS_FILTRO: { value: TipoConteudo | ""; label: string }[] = [
  { value: "", label: "Todos os tipos" },
  { value: "legenda_instagram", label: "Instagram" },
  { value: "legenda_facebook", label: "Facebook" },
  { value: "legenda_linkedin", label: "LinkedIn" },
  { value: "email_marketing", label: "E-mail Marketing" },
  { value: "descricao_produto", label: "Descrição de Produto" },
  { value: "proposta_comercial", label: "Proposta Comercial" },
  { value: "relatorio_negocio", label: "Relatório" },
  { value: "insight", label: "Insight" },
];

function ConteudoCard({
  conteudo,
  onToggleFavorito,
}: {
  conteudo: { id: string; tipo: TipoConteudo; tipo_display: string; prompt_usuario: string; resultado: string; modelo_usado: string; tokens_usados: number; favorito: boolean; criado_em: string };
  onToggleFavorito: (id: string) => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const [expandido, setExpandido] = useState(false);

  const copiar = async () => {
    await navigator.clipboard.writeText(conteudo.resultado);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const preview = conteudo.resultado.slice(0, 150);
  const temMais = conteudo.resultado.length > 150;

  return (
    <Card className={`transition-all ${conteudo.favorito ? "border-amber-200 bg-amber-50/30" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">{TIPO_CONTEUDO_ICONE[conteudo.tipo]}</span>
            <Badge variant="secondary" className="text-xs">
              {TIPO_CONTEUDO_LABELS[conteudo.tipo] || conteudo.tipo_display}
            </Badge>
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Clock className="h-3 w-3" />
              {new Date(conteudo.criado_em).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleFavorito(conteudo.id)}
              className={`h-7 w-7 p-0 ${conteudo.favorito ? "text-amber-500" : "text-slate-400 hover:text-amber-500"}`}
              aria-label={conteudo.favorito ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            >
              <Star className={`h-4 w-4 ${conteudo.favorito ? "fill-current" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={copiar}
              className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
              aria-label="Copiar conteúdo"
            >
              {copiado ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {conteudo.prompt_usuario && (
          <p className="text-xs text-slate-500 mb-2 italic">
            &quot;{conteudo.prompt_usuario.slice(0, 80)}{conteudo.prompt_usuario.length > 80 ? "..." : ""}&quot;
          </p>
        )}

        <div className="bg-white rounded border border-slate-100 p-3 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
          {expandido ? conteudo.resultado : preview}
          {temMais && !expandido && "..."}
        </div>

        {temMais && (
          <button
            onClick={() => setExpandido(!expandido)}
            className="text-xs text-purple-600 hover:text-purple-700 mt-1"
          >
            {expandido ? "Ver menos" : "Ver mais"}
          </button>
        )}

        <p className="text-xs text-slate-400 mt-2">
          {conteudo.modelo_usado} · {conteudo.tokens_usados} tokens
        </p>
      </CardContent>
    </Card>
  );
}

export function HistoricoConteudos() {
  const [tipoFiltro, setTipoFiltro] = useState<TipoConteudo | "">("");
  const [favoritoFiltro, setFavoritoFiltro] = useState<boolean | undefined>(undefined);

  const { conteudos, isLoading, toggleFavorito } = useHistoricoConteudos(
    tipoFiltro,
    favoritoFiltro
  );

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Filter className="h-4 w-4" />
          <span>Filtrar:</span>
        </div>
        <Select
          value={tipoFiltro}
          onValueChange={(v) => setTipoFiltro(v as TipoConteudo | "")}
        >
          <SelectTrigger className="w-48 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIPOS_FILTRO.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={favoritoFiltro ? "default" : "outline"}
          size="sm"
          onClick={() => setFavoritoFiltro(favoritoFiltro ? undefined : true)}
          className="h-8 gap-1"
        >
          <Star className={`h-3.5 w-3.5 ${favoritoFiltro ? "fill-current" : ""}`} />
          Favoritos
        </Button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-slate-100 rounded w-1/3 mb-3" />
                <div className="h-16 bg-slate-100 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : conteudos.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <p className="text-sm text-slate-400">
              {favoritoFiltro
                ? "Nenhum conteúdo favorito encontrado."
                : tipoFiltro
                ? "Nenhum conteúdo deste tipo encontrado."
                : "Nenhum conteúdo gerado ainda. Use o formulário ao lado para começar!"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {conteudos.map((c) => (
            <ConteudoCard
              key={c.id}
              conteudo={c}
              onToggleFavorito={toggleFavorito}
            />
          ))}
        </div>
      )}
    </div>
  );
}
