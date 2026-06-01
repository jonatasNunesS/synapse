"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Plus, Pencil, Trash2, Loader2, Tag } from "lucide-react";
import { useCategorias } from "@/hooks/useFinanceiro";
import type { Categoria } from "@/types/financeiro";

const CORES_PRESET = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#06b6d4", "#64748b", "#78716c",
];

const categoriaSchema = z.object({
  nome: z.string().min(2, "Mínimo 2 caracteres.").max(50, "Máximo 50 caracteres."),
  tipo: z.enum(["receita", "despesa"]),
  cor: z.string().min(1, "Escolha uma cor."),
});

type CategoriaFormData = z.infer<typeof categoriaSchema>;

interface CategoriaFinanceiroModalProps {
  onClose: () => void;
}

export function CategoriaFinanceiroModal({ onClose }: CategoriaFinanceiroModalProps) {
  const { categorias, loading, criar, atualizar, deletar } = useCategorias();
  const [editando, setEditando] = useState<Categoria | null>(null);
  const [confirmandoDelete, setConfirmandoDelete] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [tipoFiltro, setTipoFiltro] = useState<"receita" | "despesa" | "todos">("todos");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoriaFormData>({
    resolver: zodResolver(categoriaSchema),
    defaultValues: { tipo: "receita", cor: CORES_PRESET[0] },
  });

  const corSelecionada = watch("cor");

  const abrirEdicao = (cat: Categoria) => {
    setEditando(cat);
    reset({ nome: cat.nome, tipo: cat.tipo, cor: cat.cor || CORES_PRESET[0] });
    setServerError(null);
  };

  const fecharForm = () => {
    setEditando(null);
    reset({ tipo: "receita", cor: CORES_PRESET[0], nome: "" });
    setServerError(null);
  };

  const onSubmit = async (data: CategoriaFormData) => {
    setServerError(null);
    try {
      if (editando) {
        await atualizar(editando.id, data);
      } else {
        await criar(data);
      }
      fecharForm();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setServerError(e?.response?.data?.error?.message ?? "Erro ao salvar categoria.");
    }
  };

  const handleDeletar = async (id: string) => {
    setServerError(null);
    try {
      await deletar(id);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setServerError(e?.response?.data?.error?.message ?? "Erro ao excluir categoria.");
    } finally {
      setConfirmandoDelete(null);
    }
  };

  const categoriasFiltradas = tipoFiltro === "todos"
    ? categorias
    : categorias.filter((c) => c.tipo === tipoFiltro);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-violet-400" />
            <h2 className="text-lg font-semibold text-white">Categorias Financeiras</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col lg:flex-row flex-1 min-h-0">
          {/* Form */}
          <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-white/10 p-6 flex-shrink-0">
            <h3 className="text-sm font-medium text-slate-300 mb-4">
              {editando ? "Editar categoria" : "Nova categoria"}
            </h3>

            {serverError && (
              <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Nome *</label>
                <input
                  {...register("nome")}
                  placeholder="Ex: Vendas, Aluguel..."
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
                />
                {errors.nome && <p className="mt-1 text-xs text-red-400">{errors.nome.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Tipo *</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["receita", "despesa"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setValue("tipo", t)}
                      className={`py-2 rounded-lg text-xs font-medium transition-all capitalize ${
                        watch("tipo") === t
                          ? t === "receita"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                            : "bg-red-500/20 text-red-400 border border-red-500/50"
                          : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
                      }`}
                    >
                      {t === "receita" ? "Receita" : "Despesa"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Cor *</label>
                <div className="flex flex-wrap gap-2">
                  {CORES_PRESET.map((cor) => (
                    <button
                      key={cor}
                      type="button"
                      onClick={() => setValue("cor", cor)}
                      className={`w-6 h-6 rounded-full transition-all ${
                        corSelecionada === cor ? "ring-2 ring-white ring-offset-2 ring-offset-[#0f1117] scale-110" : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: cor }}
                    />
                  ))}
                </div>
                <input {...register("cor")} type="hidden" />
                {errors.cor && <p className="mt-1 text-xs text-red-400">{errors.cor.message}</p>}
              </div>

              <div className="flex gap-2 pt-1">
                {editando && (
                  <button
                    type="button"
                    onClick={fecharForm}
                    className="flex-1 py-2 px-3 rounded-lg border border-white/10 text-xs font-medium text-slate-400 hover:bg-white/5 transition-colors"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-xs font-medium text-white transition-colors"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : editando ? (
                    <Pencil className="h-3.5 w-3.5" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  {editando ? "Salvar" : "Criar"}
                </button>
              </div>
            </form>
          </div>

          {/* List */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10 flex-shrink-0">
              {(["todos", "receita", "despesa"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTipoFiltro(t)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize ${
                    tipoFiltro === t
                      ? "bg-violet-500/20 text-violet-400"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {t === "todos" ? "Todos" : t === "receita" ? "Receitas" : "Despesas"}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="flex items-center justify-center py-10 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando...
                </div>
              ) : categoriasFiltradas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Tag className="h-8 w-8 text-slate-600 mb-2" />
                  <p className="text-sm text-slate-500">Nenhuma categoria encontrada.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {categoriasFiltradas.map((cat) => (
                    <div key={cat.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.cor || "#6366f1" }} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-white truncate block">{cat.nome}</span>
                        <span className={`text-xs ${cat.tipo === "receita" ? "text-emerald-400" : "text-red-400"}`}>
                          {cat.tipo === "receita" ? "Receita" : "Despesa"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => abrirEdicao(cat)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-violet-400 hover:bg-violet-500/10 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {confirmandoDelete === cat.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDeletar(cat.id)}
                              className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => setConfirmandoDelete(null)}
                              className="px-2 py-1 rounded text-xs text-slate-400 hover:text-white transition-colors"
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmandoDelete(cat.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
