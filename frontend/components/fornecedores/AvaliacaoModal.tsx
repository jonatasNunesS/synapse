"use client";

import { useState } from "react";
import { X, Loader2, Star } from "lucide-react";
import { useFornecedorDetail } from "@/hooks/useFornecedores";
import { AvaliacaoStars } from "./AvaliacaoStars";
import type { FornecedorDetail } from "@/types/fornecedores";
import type { ApiError } from "@/types/api";

interface AvaliacaoModalProps {
  fornecedor: FornecedorDetail;
  onSuccess: (f: FornecedorDetail) => void;
  onClose: () => void;
}

export function AvaliacaoModal({ fornecedor, onSuccess, onClose }: AvaliacaoModalProps) {
  const { avaliar } = useFornecedorDetail();
  const [qualidade, setQualidade] = useState<number>(fornecedor.avaliacao_qualidade ?? 0);
  const [prazo, setPrazo] = useState<number>(fornecedor.avaliacao_prazo ?? 0);
  const [preco, setPreco] = useState<number>(fornecedor.avaliacao_preco ?? 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!qualidade || !prazo || !preco) {
      setError("Avalie todos os critérios antes de salvar.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await avaliar(fornecedor.id, {
        avaliacao_qualidade: qualidade,
        avaliacao_prazo: prazo,
        avaliacao_preco: preco,
      });
      onSuccess(result);
    } catch (err: unknown) {
      const e = err as ApiError;
      setError(e?.error?.message ?? "Erro ao salvar avaliação");
    } finally {
      setLoading(false);
    }
  };

  const media = qualidade && prazo && preco
    ? ((qualidade + prazo + preco) / 3).toFixed(1)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-alerta" />
            <h2 className="text-base font-semibold text-foreground">Avaliar Fornecedor</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-superficie-forte hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="mb-5 text-sm text-muted-foreground">
            Avaliando: <span className="font-medium text-foreground">{fornecedor.nome}</span>
          </p>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-erro">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-superficie p-4">
              <AvaliacaoStars
                value={qualidade || null}
                onChange={setQualidade}
                size="lg"
                label="Qualidade dos Produtos/Serviços"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Avalie a qualidade do que foi entregue
              </p>
            </div>

            <div className="rounded-xl border border-border bg-superficie p-4">
              <AvaliacaoStars
                value={prazo || null}
                onChange={setPrazo}
                size="lg"
                label="Cumprimento de Prazos"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Avalie a pontualidade nas entregas
              </p>
            </div>

            <div className="rounded-xl border border-border bg-superficie p-4">
              <AvaliacaoStars
                value={preco || null}
                onChange={setPreco}
                size="lg"
                label="Competitividade de Preço"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Avalie o custo-benefício oferecido
              </p>
            </div>
          </div>

          {/* Média preview */}
          {media && (
            <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Média geral:{" "}
                <span className="font-bold text-alerta">{media} / 5.0</span>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-superficie hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !qualidade || !prazo || !preco}
            className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-amber-400 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar Avaliação
          </button>
        </div>
      </div>
    </div>
  );
}
