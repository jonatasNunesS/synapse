"use client";

/**
 * Synapse — Edição de lançamento PAGO (fluxo auditado, admin-only).
 *
 * Modal em 3 etapas visuais (mesmo modal):
 *   1. Formulário de edição (campos do lançamento)
 *   2. Aviso de impacto (âmbar): saldos e análises do período são afetados
 *   3. Motivo obrigatório (5+ caracteres) — botão salvar só habilita com ele
 *
 * O backend exige perfil admin + motivo e gera log de auditoria completo.
 */

import { useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import type { Categoria, Lancamento, LancamentoCreate } from "@/types/financeiro";

const MOTIVO_MIN = 5;
const MOTIVO_MAX = 500;

interface EditarPagoModalProps {
  lancamento: Lancamento;
  categorias: Categoria[];
  onSubmit: (dados: Partial<LancamentoCreate>, motivo: string) => Promise<void>;
  onClose: () => void;
}

const ETAPAS = ["Dados", "Impacto", "Motivo"] as const;

function mesDoLancamento(l: Lancamento): string {
  const ref = l.data_pagamento || l.data_vencimento;
  return new Date(`${ref}T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

export function EditarPagoModal({
  lancamento,
  categorias,
  onSubmit,
  onClose,
}: EditarPagoModalProps) {
  const [etapa, setEtapa] = useState(0);
  const [salvando, setSalvando] = useState(false);

  // Etapa 1 — campos editáveis
  const [descricao, setDescricao] = useState(lancamento.descricao);
  const [valor, setValor] = useState(String(lancamento.valor));
  const [categoria, setCategoria] = useState(lancamento.categoria ?? "");
  const [dataVencimento, setDataVencimento] = useState(lancamento.data_vencimento);
  const [dataPagamento, setDataPagamento] = useState(lancamento.data_pagamento ?? "");
  const [observacoes, setObservacoes] = useState(lancamento.observacoes ?? "");

  // Etapa 3 — motivo
  const [motivo, setMotivo] = useState("");

  const valorNum = parseFloat(valor.replace(",", "."));
  const dadosValidos =
    descricao.trim().length >= 3 && !isNaN(valorNum) && valorNum > 0 && !!dataPagamento;
  const motivoValido =
    motivo.trim().length >= MOTIVO_MIN && motivo.trim().length <= MOTIVO_MAX;

  const categoriasFiltradas = categorias.filter((c) => c.tipo === lancamento.tipo);

  const salvar = async () => {
    if (!motivoValido || salvando) return;
    setSalvando(true);
    try {
      await onSubmit(
        {
          descricao: descricao.trim(),
          valor: valorNum,
          categoria: categoria || null,
          data_vencimento: dataVencimento,
          data_pagamento: dataPagamento,
          observacoes,
        },
        motivo.trim()
      );
    } finally {
      setSalvando(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2.5 bg-superficie border border-border rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl">
        {/* Header + indicador de etapas */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Editar lançamento pago
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-superficie-forte transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3" aria-label="Etapas">
            {ETAPAS.map((nome, i) => (
              <div key={nome} className="flex items-center gap-2">
                <span
                  className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${
                    i === etapa
                      ? "bg-brand-600/20 text-brand-accent border border-brand-500/40"
                      : i < etapa
                        ? "text-sucesso"
                        : "text-muted-suave"
                  }`}
                >
                  {i + 1}. {nome}
                </span>
                {i < ETAPAS.length - 1 && (
                  <ChevronRight className="w-3 h-3 text-slate-600" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
          {/* ── ETAPA 1: Formulário ─────────────────────────── */}
          {etapa === 0 && (
            <>
              <div>
                <label className="block text-sm font-medium text-foreground-suave mb-1.5">
                  Descrição *
                </label>
                <input
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground-suave mb-1.5">
                    Valor (R$) *
                  </label>
                  <input
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-suave mb-1.5">
                    Categoria
                  </label>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Sem categoria</option>
                    {categoriasFiltradas.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground-suave mb-1.5">
                    Vencimento
                  </label>
                  <input
                    type="date"
                    value={dataVencimento}
                    onChange={(e) => setDataVencimento(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-suave mb-1.5">
                    Data de pagamento *
                  </label>
                  <input
                    type="date"
                    value={dataPagamento}
                    onChange={(e) => setDataPagamento(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-suave mb-1.5">
                  Observações
                </label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={2}
                  className={`${inputClass} resize-none`}
                />
              </div>
            </>
          )}

          {/* ── ETAPA 2: Aviso de impacto ───────────────────── */}
          {etapa === 1 && (
            <div
              role="alert"
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-alerta flex-shrink-0 mt-0.5" />
                <div className="text-sm text-alerta space-y-2">
                  <p className="font-semibold text-alerta">
                    Editar um lançamento pago afeta:
                  </p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Saldo acumulado da empresa</li>
                    <li>Saldo do mês de {mesDoLancamento(lancamento)}</li>
                    <li>Análises financeiras já geradas para este período</li>
                  </ul>
                  <p>Certifique-se de que a alteração está correta.</p>
                </div>
              </div>
            </div>
          )}

          {/* ── ETAPA 3: Motivo obrigatório ─────────────────── */}
          {etapa === 2 && (
            <div>
              <label className="block text-sm font-medium text-foreground-suave mb-1.5">
                Por que está editando? (obrigatório)
              </label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                maxLength={MOTIVO_MAX}
                placeholder="Ex: corrigir valor digitado errado, conciliação bancária, ajuste após confirmação com fornecedor..."
                className={`${inputClass} resize-none`}
              />
              <p className="mt-1 text-xs text-muted-suave">
                {motivo.trim().length < MOTIVO_MIN
                  ? `Mínimo ${MOTIVO_MIN} caracteres (${motivo.trim().length}/${MOTIVO_MIN}). `
                  : `${motivo.trim().length}/${MOTIVO_MAX} caracteres. `}
                O motivo fica registrado no histórico de auditoria, visível a
                todos da empresa.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border">
          <button
            type="button"
            onClick={() => (etapa === 0 ? onClose() : setEtapa(etapa - 1))}
            disabled={salvando}
            className="inline-flex items-center gap-1.5 py-2.5 px-4 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-superficie transition-colors disabled:opacity-50"
          >
            {etapa > 0 && <ChevronLeft className="w-4 h-4" />}
            {etapa === 0 ? "Cancelar" : "Voltar"}
          </button>

          {etapa < 2 ? (
            <button
              type="button"
              onClick={() => setEtapa(etapa + 1)}
              disabled={etapa === 0 && !dadosValidos}
              className="inline-flex items-center gap-1.5 py-2.5 px-4 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
            >
              Avançar
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={salvar}
              disabled={!motivoValido || salvando}
              className="inline-flex items-center gap-2 py-2.5 px-4 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
            >
              {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar alteração
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
