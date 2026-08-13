"use client";
/**
 * Edição das informações básicas da empresa: nome e segmento. Plano tem fluxo
 * próprio (Trocar plano, com histórico), então não entra aqui.
 */
import { useState } from "react";
import { toast } from "sonner";
import { X, Loader2, Pencil } from "lucide-react";
import { editarEmpresa } from "@/hooks/usePainelAdmin";
import { getErrorMessage } from "@/lib/api";
import { SEGMENTOS } from "@/types/painel_admin";

interface Props {
  empresaId: string;
  nomeAtual: string;
  segmentoAtual: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditarEmpresaModal({
  empresaId,
  nomeAtual,
  segmentoAtual,
  onClose,
  onSuccess,
}: Props) {
  const [nome, setNome] = useState(nomeAtual);
  const [segmento, setSegmento] = useState(segmentoAtual);
  const [enviando, setEnviando] = useState(false);

  const mudou = nome.trim() !== nomeAtual || segmento !== segmentoAtual;
  const valido = nome.trim().length > 0 && mudou;

  const salvar = async () => {
    if (!valido || enviando) return;
    setEnviando(true);
    try {
      await editarEmpresa(empresaId, { nome: nome.trim(), segmento });
      toast.success("Alterações salvas.");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Pencil className="h-4 w-4 text-alerta" />
            Editar empresa
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Nome da empresa</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Segmento</label>
            <select
              value={segmento}
              onChange={(e) => setSegmento(e.target.value)}
              className={inputCls}
            >
              {SEGMENTOS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-sm text-foreground-suave hover:bg-secondary transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={!valido || enviando}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-slate-950 text-sm font-medium hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar alterações
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-white placeholder:text-muted-suave focus:outline-none focus:ring-1 focus:ring-amber-500";
