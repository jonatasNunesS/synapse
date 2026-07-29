"use client";
/**
 * Modal (admin) para gerenciar as colunas do Kanban da equipe: reordenar
 * (setas), renomear, mudar cor, adicionar e excluir. Excluir coluna com tarefas
 * exige escolher para qual coluna mover as tarefas (confirmação).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X, Plus, Trash2, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { useColunasEquipe } from "@/hooks/useEquipe";
import { getErrorMessage } from "@/lib/api";
import type { ColunaKanban } from "@/types/equipe";

interface Props {
  onFechar: () => void;
  onMudou: () => void;
}

export function EditarColunasModal({ onFechar, onMudou }: Props) {
  const { colunas, isLoading, criarColuna, atualizarColuna, excluirColuna, reordenarColunas } =
    useColunasEquipe();
  const [locais, setLocais] = useState<ColunaKanban[]>([]);
  const [novaCol, setNovaCol] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [excluir, setExcluir] = useState<ColunaKanban | null>(null);
  const [moverPara, setMoverPara] = useState("");

  // Chave estável do conteúdo das colunas: evita re-sincronizar (e loopar) a
  // cada novo array vindo do hook — só reage a mudanças reais.
  const colunasKey = colunas
    .map((c) => `${c.id}:${c.ordem}:${c.nome}:${c.cor}`)
    .join("|");
  useEffect(() => {
    setLocais([...colunas].sort((a, b) => a.ordem - b.ordem));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colunasKey]);

  const mover = async (idx: number, dir: -1 | 1) => {
    const destino = idx + dir;
    if (destino < 0 || destino >= locais.length) return;
    const arr = [...locais];
    [arr[idx], arr[destino]] = [arr[destino], arr[idx]];
    setLocais(arr);
    try {
      await reordenarColunas(arr.map((c, i) => ({ id: c.id, ordem: i + 1 })));
      onMudou();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const renomear = async (col: ColunaKanban, nome: string) => {
    try {
      await atualizarColuna(col.id, { nome });
      onMudou();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const mudarCor = async (col: ColunaKanban, cor: string) => {
    try {
      await atualizarColuna(col.id, { cor });
      onMudou();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const adicionar = async () => {
    if (!novaCol.trim() || salvando) return;
    setSalvando(true);
    try {
      await criarColuna({ nome: novaCol.trim() });
      setNovaCol("");
      onMudou();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSalvando(false);
    }
  };

  const confirmarExclusao = async () => {
    if (!excluir) return;
    setSalvando(true);
    try {
      await excluirColuna(excluir.id, moverPara || undefined);
      setExcluir(null);
      setMoverPara("");
      onMudou();
    } catch (err) {
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900">
          <h2 className="text-sm font-semibold text-white">Editar colunas</h2>
          <button onClick={onFechar} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-2">
          {isLoading && <Loader2 className="h-5 w-5 animate-spin text-violet-400 mx-auto" />}
          {locais.map((col, idx) => (
            <div
              key={col.id}
              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-800/40 px-2 py-2"
            >
              <div className="flex flex-col">
                <button
                  onClick={() => mover(idx, -1)}
                  disabled={idx === 0}
                  className="text-slate-500 hover:text-white disabled:opacity-30"
                  title="Subir"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => mover(idx, 1)}
                  disabled={idx === locais.length - 1}
                  className="text-slate-500 hover:text-white disabled:opacity-30"
                  title="Descer"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <input
                type="color"
                value={col.cor || "#64748b"}
                onChange={(e) => mudarCor(col, e.target.value)}
                className="h-7 w-7 rounded bg-transparent border-0 cursor-pointer"
                title="Cor da coluna"
              />
              <input
                defaultValue={col.nome}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== col.nome)
                    renomear(col, e.target.value.trim());
                }}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <button
                onClick={() => setExcluir(col)}
                className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-700/50"
                title="Excluir coluna"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          {/* Adicionar nova */}
          <div className="flex items-center gap-2 pt-2">
            <input
              value={novaCol}
              onChange={(e) => setNovaCol(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && adicionar()}
              placeholder="Nome da nova coluna"
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <button
              onClick={adicionar}
              disabled={!novaCol.trim() || salvando}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" /> Adicionar
            </button>
          </div>
        </div>
      </div>

      {/* Confirmação de exclusão com destino das tarefas */}
      {excluir && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-red-500/30 bg-slate-900 shadow-xl p-5">
            <h3 className="text-sm font-semibold text-white">
              Excluir “{excluir.nome}”?
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Se a coluna tiver tarefas, elas serão movidas para a coluna escolhida
              abaixo. Tarefas de projeto deixam de aparecer no Kanban da equipe até
              o admin reconfigurá-las.
            </p>
            <label className="text-xs text-slate-400 block mt-3 mb-1">Mover tarefas para</label>
            <select
              value={moverPara}
              onChange={(e) => setMoverPara(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              <option value="">— selecione —</option>
              {locais
                .filter((c) => c.id !== excluir.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
            </select>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setExcluir(null);
                  setMoverPara("");
                }}
                className="px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarExclusao}
                disabled={salvando}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 disabled:opacity-40"
              >
                {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
