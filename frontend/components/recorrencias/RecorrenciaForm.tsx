"use client";
/**
 * Form de nova/editar recorrência (modal). Valida campos obrigatórios.
 */
import { useState } from "react";
import { toast } from "sonner";
import { X, Loader2 } from "lucide-react";
import { useCategorias } from "@/hooks/useFinanceiro";
import { getErrorMessage } from "@/lib/api";
import { DIAS_SEMANA } from "@/types/recorrencias";
import type {
  Recorrencia,
  RecorrenciaFormData,
  FrequenciaTipo,
  TipoRecorrencia,
} from "@/types/recorrencias";

interface Props {
  inicial?: Recorrencia | null;
  onClose: () => void;
  onSubmit: (dados: RecorrenciaFormData) => Promise<void>;
}

export function RecorrenciaForm({ inicial, onClose, onSubmit }: Props) {
  const { categorias } = useCategorias();
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [tipo, setTipo] = useState<TipoRecorrencia>(inicial?.tipo ?? "receita");
  const [valor, setValor] = useState(inicial?.valor_padrao ?? "");
  const [categoria, setCategoria] = useState(inicial?.categoria ?? "");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [freq, setFreq] = useState<FrequenciaTipo>(inicial?.frequencia_tipo ?? "mensal");
  const [diaRef, setDiaRef] = useState(inicial?.dia_referencia ?? 5);
  const [usaDiaUtil, setUsaDiaUtil] = useState(inicial?.usa_dia_util ?? false);
  const [aviso, setAviso] = useState(inicial?.avisar_com_antecedencia ?? 0);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  const validar = (): boolean => {
    const e: Record<string, string> = {};
    if (!titulo.trim()) e.titulo = "Título é obrigatório.";
    if (!valor || parseFloat(valor) <= 0) e.valor = "Informe um valor positivo.";
    if (freq === "mensal" && (diaRef < 1 || diaRef > 31))
      e.dia = "Dia do mês entre 1 e 31.";
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (salvando || !validar()) return;
    setSalvando(true);
    try {
      await onSubmit({
        titulo: titulo.trim(),
        tipo,
        valor_padrao: valor,
        categoria: categoria || null,
        descricao: descricao.trim(),
        frequencia_tipo: freq,
        dia_referencia: freq === "diario" ? 0 : diaRef,
        usa_dia_util: usaDiaUtil,
        avisar_com_antecedencia: aviso,
      });
      toast.success(inicial ? "Recorrência atualizada." : "Recorrência criada.");
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err), { duration: 7000 });
      setSalvando(false);
    }
  };

  const catsDoTipo = categorias.filter((c) => c.tipo === tipo);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border sticky top-0 bg-card">
          <h2 className="text-sm font-semibold text-foreground">
            {inicial ? "Editar recorrência" : "Nova recorrência"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Título *</label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Salário Patrícia"
              className="w-full rounded-lg border border-border bg-superficie px-3 py-2 text-sm text-foreground focus:outline-none focus:border-brand-500"
            />
            {erros.titulo && <p className="text-xs text-erro mt-1">{erros.titulo}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Tipo</label>
              <select
                value={tipo}
                onChange={(e) => {
                  setTipo(e.target.value as TipoRecorrencia);
                  setCategoria("");
                }}
                className="w-full rounded-lg border border-border bg-card shadow-elevacao px-3 py-2 text-sm text-foreground focus:outline-none focus:border-brand-500"
              >
                <option value="receita">Receita</option>
                <option value="despesa">Despesa</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Valor esperado *</label>
              <input
                type="number"
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-lg border border-border bg-superficie px-3 py-2 text-sm text-foreground focus:outline-none focus:border-brand-500"
              />
              {erros.valor && <p className="text-xs text-erro mt-1">{erros.valor}</p>}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Categoria</label>
            <select
              value={categoria ?? ""}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full rounded-lg border border-border bg-card shadow-elevacao px-3 py-2 text-sm text-foreground focus:outline-none focus:border-brand-500"
            >
              <option value="">Sem categoria</option>
              {catsDoTipo.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Frequência</label>
              <select
                value={freq}
                onChange={(e) => setFreq(e.target.value as FrequenciaTipo)}
                className="w-full rounded-lg border border-border bg-card shadow-elevacao px-3 py-2 text-sm text-foreground focus:outline-none focus:border-brand-500"
              >
                <option value="mensal">Mensal</option>
                <option value="semanal">Semanal</option>
                <option value="diario">Diária</option>
              </select>
            </div>
            {freq === "mensal" && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Dia do mês</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={diaRef}
                  onChange={(e) => setDiaRef(parseInt(e.target.value) || 1)}
                  className="w-full rounded-lg border border-border bg-superficie px-3 py-2 text-sm text-foreground focus:outline-none focus:border-brand-500"
                />
                {erros.dia && <p className="text-xs text-erro mt-1">{erros.dia}</p>}
              </div>
            )}
            {freq === "semanal" && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Dia da semana</label>
                <select
                  value={diaRef}
                  onChange={(e) => setDiaRef(parseInt(e.target.value))}
                  className="w-full rounded-lg border border-border bg-card shadow-elevacao px-3 py-2 text-sm text-foreground focus:outline-none focus:border-brand-500"
                >
                  {DIAS_SEMANA.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 items-center">
            <label className="flex items-center gap-2 text-sm text-foreground-suave">
              <input
                type="checkbox"
                checked={usaDiaUtil}
                onChange={(e) => setUsaDiaUtil(e.target.checked)}
                className="rounded border-border bg-superficie"
              />
              Ajustar p/ dia útil
            </label>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                Avisar (dias; 0 = no dia)
              </label>
              <input
                type="number"
                value={aviso}
                onChange={(e) => setAviso(parseInt(e.target.value) || 0)}
                className="w-full rounded-lg border border-border bg-superficie px-3 py-2 text-sm text-foreground focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Descrição (opcional)</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-border bg-superficie px-3 py-2 text-sm text-foreground focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-foreground-suave hover:bg-superficie text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium disabled:opacity-60"
            >
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              {inicial ? "Salvar" : "Criar recorrência"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
