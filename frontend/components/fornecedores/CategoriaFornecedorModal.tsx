"use client";
/**
 * Synapse — Modal de Gestão de Categorias de Fornecedores
 * Permite criar, editar e excluir categorias de fornecedores.
 */
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { X, Plus, Pencil, Trash2, Tag, Loader2 } from "lucide-react";
import { useCategoriasFornecedor } from "@/hooks/useFornecedores";
import { getErrorMessage } from "@/lib/api";
import type { CategoriaFornecedor } from "@/types/fornecedores";

const CORES_PRESET = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#64748b",
];

interface FormData {
  nome: string;
  cor: string;
}

interface Props {
  onFechar: () => void;
}

export function CategoriaFornecedorModal({ onFechar }: Props) {
  const { data: categorias, loading, fetch, criar, atualizar, excluir } =
    useCategoriasFornecedor();
  const [editando, setEditando] = useState<CategoriaFornecedor | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [corSelecionada, setCorSelecionada] = useState("#6366f1");
  const [erroGlobal, setErroGlobal] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: { nome: "", cor: "#6366f1" },
  });

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    if (editando) {
      reset({ nome: editando.nome, cor: editando.cor ?? "#6366f1" });
      setCorSelecionada(editando.cor ?? "#6366f1");
    }
  }, [editando, reset]);

  const onSubmit = async (dados: FormData) => {
    setErroGlobal(null);
    setSalvando(true);
    try {
      const payload = { nome: dados.nome, cor: corSelecionada };
      if (editando) {
        await atualizar(editando.id, payload);
      } else {
        await criar(payload);
      }
      reset();
      setCorSelecionada("#6366f1");
      setEditando(null);
      setShowForm(false);
    } catch (err: unknown) {
      setErroGlobal(getErrorMessage(err));
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (id: string, nome: string) => {
    if (!confirm(`Excluir a categoria "${nome}"? Fornecedores vinculados perderão a categoria.`)) return;
    setErroGlobal(null);
    try {
      await excluir(id);
    } catch (err: unknown) {
      setErroGlobal(getErrorMessage(err));
    }
  };

  const handleNovaCategoria = () => {
    setEditando(null);
    reset({ nome: "", cor: "#6366f1" });
    setCorSelecionada("#6366f1");
    setShowForm(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onFechar} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/20">
              <Tag className="h-4 w-4 text-violet-400" />
            </div>
            <h2 className="text-base font-semibold text-slate-100">Categorias de Fornecedores</h2>
          </div>
          <button
            onClick={onFechar}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Erro global */}
          {erroGlobal && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              {erroGlobal}
            </div>
          )}

          {/* Lista de categorias */}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
            </div>
          ) : categorias.length === 0 && !showForm ? (
            <div className="rounded-xl border border-dashed border-slate-700 py-8 text-center">
              <Tag className="mx-auto h-8 w-8 text-slate-600 mb-2" />
              <p className="text-sm text-slate-500">Nenhuma categoria cadastrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {categorias.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/40 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.cor ?? "#6366f1" }}
                    />
                    <span className="text-sm font-medium text-slate-200">{cat.nome}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditando(cat); setShowForm(true); }}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-slate-700 hover:text-slate-300 transition-colors"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleExcluir(cat.id, cat.nome)}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Formulário de criação/edição */}
          {showForm && (
            <form onSubmit={handleSubmit(onSubmit)} className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 space-y-4">
              <h3 className="text-sm font-semibold text-slate-200">
                {editando ? "Editar categoria" : "Nova categoria"}
              </h3>

              {/* Nome */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Nome *</label>
                <input
                  {...register("nome", { required: "Nome é obrigatório" })}
                  placeholder="Ex: Matéria-prima"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/40"
                />
                {errors.nome && (
                  <p className="mt-1 text-xs text-red-400">{errors.nome.message}</p>
                )}
              </div>

              {/* Cor */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Cor</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {CORES_PRESET.map((cor) => (
                    <button
                      key={cor}
                      type="button"
                      onClick={() => setCorSelecionada(cor)}
                      className="h-6 w-6 rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: cor,
                        borderColor: corSelecionada === cor ? "white" : "transparent",
                        transform: corSelecionada === cor ? "scale(1.2)" : "scale(1)",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Botões */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
                >
                  {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {editando ? "Salvar alterações" : "Criar categoria"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditando(null); reset(); }}
                  className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Botão nova categoria */}
          {!showForm && (
            <button
              onClick={handleNovaCategoria}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 py-3 text-sm text-slate-500 hover:border-violet-500/40 hover:text-violet-400 hover:bg-violet-500/5 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nova categoria
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
