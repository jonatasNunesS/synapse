"use client";
/**
 * Central de Recorrências — /financeiro/recorrencias.
 * Lista as recorrências, permite criar/editar/pausar/reativar/encerrar, e abre
 * o modal de decisão quando chega pelo sino (?ocorrencia=<id>).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Repeat,
  Pause,
  Play,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { useRecorrencias, obterOcorrencia } from "@/hooks/useRecorrencias";
import { RecorrenciaForm } from "@/components/recorrencias/RecorrenciaForm";
import { OcorrenciaDecisaoModal } from "@/components/recorrencias/OcorrenciaDecisaoModal";
import { getErrorMessage } from "@/lib/api";
import { descreverFrequencia } from "@/types/recorrencias";
import type { Recorrencia, OcorrenciaDetalhe } from "@/types/recorrencias";

function moeda(v: string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    parseFloat(v) || 0
  );
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  confirmada: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
  cancelada: <XCircle className="h-3.5 w-3.5 text-red-400" />,
  adiada: <Clock className="h-3.5 w-3.5 text-amber-400" />,
  pendente: <Clock className="h-3.5 w-3.5 text-violet-400" />,
  encerrada: <XCircle className="h-3.5 w-3.5 text-zinc-500" />,
};

export default function RecorrenciasPage() {
  const { recorrencias, loading, criar, atualizar, pausar, reativar, encerrar, recarregar } =
    useRecorrencias();
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState<Recorrencia | null>(null);
  const [ocorrencia, setOcorrencia] = useState<OcorrenciaDetalhe | null>(null);

  // Chegou pelo sino? (?ocorrencia=<id>) → abre o modal de decisão.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("ocorrencia");
    if (!id) return;
    obterOcorrencia(id)
      .then((oc) => {
        if (oc.status === "pendente" || oc.status === "adiada") setOcorrencia(oc);
        else toast.info("Essa ocorrência já foi resolvida.");
      })
      .catch((e) => toast.error(getErrorMessage(e)));
  }, []);

  const abrirNova = () => {
    setEditando(null);
    setMostrarForm(true);
  };
  const abrirEditar = (r: Recorrencia) => {
    setEditando(r);
    setMostrarForm(true);
  };

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/financeiro"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Financeiro
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Repeat className="h-6 w-6 text-violet-400" />
              Recorrências
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Modelos que geram perguntas no sino. Nada vira lançamento sem você confirmar.
            </p>
          </div>
          <button
            onClick={abrirNova}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nova recorrência
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
        </div>
      ) : recorrencias.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-10 text-center">
          <Repeat className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm text-zinc-400">
            Nenhuma recorrência ainda. Crie a primeira (ex.: salário, aluguel).
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {recorrencias.map((r) => (
            <div
              key={r.id}
              className={`rounded-xl border p-4 ${
                r.ativa ? "border-white/10 bg-white/[0.03]" : "border-white/10 bg-white/[0.01] opacity-70"
              }`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-white">{r.titulo}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        r.tipo === "receita"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-red-500/15 text-red-400"
                      }`}
                    >
                      {r.tipo}
                    </span>
                    {!r.ativa && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-500/20 text-zinc-400">
                        pausada
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-400 mt-0.5">
                    {moeda(r.valor_padrao)} · {descreverFrequencia(r)}
                    {r.categoria_nome ? ` · ${r.categoria_nome}` : ""}
                  </p>
                  {r.ativa && r.proxima_prevista && (
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Próxima prevista:{" "}
                      {new Date(r.proxima_prevista + "T00:00:00").toLocaleDateString("pt-BR")}
                    </p>
                  )}
                  {/* Últimas 3 ocorrências */}
                  {r.ultimas_ocorrencias.length > 0 && (
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {r.ultimas_ocorrencias.map((oc) => (
                        <span
                          key={oc.id}
                          className="inline-flex items-center gap-1 text-[11px] text-zinc-500"
                          title={oc.status}
                        >
                          {STATUS_ICON[oc.status]}
                          {new Date(oc.data_esperada + "T00:00:00").toLocaleDateString("pt-BR")}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => abrirEditar(r)}
                    className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {r.ativa ? (
                    <button
                      onClick={async () => {
                        await pausar(r.id);
                        toast.success("Recorrência pausada.");
                      }}
                      className="p-2 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-white/5 transition-colors"
                      title="Pausar"
                    >
                      <Pause className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        await reativar(r.id);
                        toast.success("Recorrência reativada.");
                      }}
                      className="p-2 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-white/5 transition-colors"
                      title="Reativar"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      await encerrar(r.id);
                      toast.success("Recorrência encerrada.");
                    }}
                    className="p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-white/5 transition-colors"
                    title="Encerrar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {mostrarForm && (
        <RecorrenciaForm
          inicial={editando}
          onClose={() => setMostrarForm(false)}
          onSubmit={async (dados) => {
            if (editando) await atualizar(editando.id, dados);
            else await criar(dados);
          }}
        />
      )}

      {ocorrencia && (
        <OcorrenciaDecisaoModal
          ocorrencia={ocorrencia}
          onClose={() => setOcorrencia(null)}
          onResolved={recarregar}
        />
      )}
    </div>
  );
}
