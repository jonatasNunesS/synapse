"use client";

import { useEffect } from "react";
import { Trophy, Medal } from "lucide-react";
import { useRankingFornecedores } from "@/hooks/useFornecedores";
import { ScoreSynapse } from "./ScoreSynapse";
import { AvaliacaoStars } from "./AvaliacaoStars";
import type { RankingFornecedor } from "@/types/fornecedores";
import { formatCurrency } from "@/lib/utils";


function PosicaoBadge({ posicao }: { posicao: number }) {
  if (posicao === 1)
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/20">
        <Trophy className="h-4 w-4 text-alerta" />
      </div>
    );
  if (posicao === 2)
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-400/20">
        <Medal className="h-4 w-4 text-foreground-suave" />
      </div>
    );
  if (posicao === 3)
    return (
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-700/20">
        <Medal className="h-4 w-4 text-alerta" />
      </div>
    );
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-superficie">
      <span className="text-xs font-bold text-muted-suave">#{posicao}</span>
    </div>
  );
}

export function RankingFornecedores() {
  const { data, loading, error, fetch } = useRankingFornecedores();

  useEffect(() => {
    fetch();
  }, [fetch]);

  return (
    <div className="rounded-xl border border-border bg-superficie backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <Trophy className="h-4 w-4 text-alerta" />
        <h3 className="text-sm font-semibold text-foreground">Ranking de Fornecedores</h3>
        <span className="ml-auto text-xs text-muted-suave">por Score Synapse</span>
      </div>

      {/* List */}
      <div className="divide-y divide-border">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-suave">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            Carregando ranking...
          </div>
        )}
        {!loading && error && (
          <p className="py-6 text-center text-sm text-erro">{error}</p>
        )}
        {!loading && !error && data.length === 0 && (
          <div className="py-8 text-center">
            <Trophy className="mx-auto mb-2 h-8 w-8 text-foreground-suave" />
            <p className="text-sm text-muted-suave">
              Nenhum fornecedor avaliado ainda.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Avalie fornecedores para ver o ranking.
            </p>
          </div>
        )}
        {!loading &&
          data.map((f: RankingFornecedor) => (
            <div
              key={f.id}
              className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-superficie"
            >
              {/* Posição */}
              <PosicaoBadge posicao={f.posicao} />

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{f.nome}</p>
                {f.categoria_nome && (
                  <p className="text-xs text-muted-suave">{f.categoria_nome}</p>
                )}
                {/* Avaliações inline */}
                <div className="mt-1 flex flex-wrap gap-3">
                  {f.avaliacao_qualidade !== null && (
                    <AvaliacaoStars value={f.avaliacao_qualidade} readonly size="sm" label="Q" />
                  )}
                  {f.avaliacao_prazo !== null && (
                    <AvaliacaoStars value={f.avaliacao_prazo} readonly size="sm" label="P" />
                  )}
                  {f.avaliacao_preco !== null && (
                    <AvaliacaoStars value={f.avaliacao_preco} readonly size="sm" label="$" />
                  )}
                </div>
              </div>

              {/* Score + Compras */}
              <div className="flex flex-col items-end gap-1.5">
                <ScoreSynapse score={f.score_synapse} size="sm" />
                <span className="text-xs text-muted-suave">
                  {formatCurrency(f.valor_total_compras)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {f.quantidade_pedidos} pedido{f.quantidade_pedidos !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
