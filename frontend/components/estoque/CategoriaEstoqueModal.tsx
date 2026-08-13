"use client";
/**
 * Synapse — M3: Modal de Gestão de Categorias de Estoque
 * Permite criar, editar e excluir categorias de produtos.
 */

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { X, Plus, Pencil, Trash2, Loader2, Tag } from "lucide-react";
import { useCategoriasEstoque } from "@/hooks/useEstoque";
import { getErrorMessage } from "@/lib/api";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { CategoriaEstoque } from "@/types/estoque";

// ── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  nome: z.string().min(2, "Nome deve ter ao menos 2 caracteres").max(100),
  descricao: z.string().max(255).optional(),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida (ex: #6366f1)").optional(),
});

type FormData = z.infer<typeof schema>;

// ── Cores pré-definidas ──────────────────────────────────────────────────────

const CORES_PRESET = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#0ea5e9", "#64748b",
];

// ── Componente ───────────────────────────────────────────────────────────────

interface CategoriaEstoqueModalProps {
  onFechar: () => void;
}

export function CategoriaEstoqueModal({ onFechar }: CategoriaEstoqueModalProps) {
  const { categorias, loading, criar, atualizar, excluir } = useCategoriasEstoque();
  const [editando, setEditando] = useState<CategoriaEstoque | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [corSelecionada, setCorSelecionada] = useState("#6366f1");
  const [erroGlobal, setErroGlobal] = useState<string | null>(null);
  const [categoriaParaExcluir, setCategoriaParaExcluir] =
    useState<CategoriaEstoque | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // Preenche formulário ao editar
  useEffect(() => {
    if (editando) {
      reset({ nome: editando.nome, descricao: editando.descricao, cor: editando.cor });
      setCorSelecionada(editando.cor || "#6366f1");
      setShowForm(true);
    }
  }, [editando, reset]);

  const onSubmit = async (dados: FormData) => {
    setErroGlobal(null);
    try {
      const payload = { ...dados, cor: corSelecionada };
      if (editando) {
        await atualizar(editando.id, payload);
      } else {
        await criar(payload);
      }
      reset();
      setCorSelecionada("#6366f1");
      setEditando(null);
      setShowForm(false);
    } catch {
      setErroGlobal("Erro ao salvar categoria. Tente novamente.");
    }
  };

  const handleConfirmarExclusao = async () => {
    if (!categoriaParaExcluir || excluindo) return; // evita duplo clique
    setErroGlobal(null);
    setExcluindo(true);
    try {
      await excluir(categoriaParaExcluir.id);
      toast.success("Categoria excluída.");
      setCategoriaParaExcluir(null);
    } catch (err) {
      // Erro NUNCA calado: mostra a mensagem real do backend
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setExcluindo(false);
    }
  };

  const handleNovaCategoria = () => {
    setEditando(null);
    reset({ nome: "", descricao: "", cor: "#6366f1" });
    setCorSelecionada("#6366f1");
    setShowForm(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onFechar} />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-brand-accent" />
            <h2 className="text-lg font-semibold text-foreground">Categorias de Estoque</h2>
          </div>
          <button
            onClick={onFechar}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-superficie-forte transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {erroGlobal && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-erro">
              {erroGlobal}
            </div>
          )}

          {/* Lista de categorias */}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-brand-accent" />
            </div>
          ) : categorias.length === 0 && !showForm ? (
            <div className="text-center py-8 text-muted-suave">
              <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma categoria cadastrada.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {categorias.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-superficie border border-border hover:border-border transition-colors"
                >
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cat.cor || "#6366f1" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{cat.nome}</p>
                    {cat.descricao && (
                      <p className="text-xs text-muted-suave truncate">{cat.descricao}</p>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => setEditando(cat)}
                      className="p-1.5 rounded-md text-muted-suave hover:text-brand-accent hover:bg-brand-500/10 transition-colors"
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setCategoriaParaExcluir(cat)}
                      className="p-1.5 rounded-md text-muted-suave hover:text-erro hover:bg-red-500/10 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Formulário inline */}
          {showForm && (
            <div className="border border-brand-500/30 rounded-xl p-4 bg-brand-500/5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">
                {editando ? "Editar Categoria" : "Nova Categoria"}
              </h3>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-foreground-suave mb-1.5">
                    Nome <span className="text-erro">*</span>
                  </label>
                  <input
                    {...register("nome")}
                    placeholder="Ex: Eletrônicos"
                    className="w-full px-3 py-2 bg-superficie border border-border rounded-lg text-foreground placeholder-slate-500 focus:outline-none focus:border-brand-500/50 transition-colors text-sm"
                  />
                  {errors.nome && <p className="mt-1 text-xs text-erro">{errors.nome.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground-suave mb-1.5">
                    Descrição <span className="text-muted-suave">(opcional)</span>
                  </label>
                  <input
                    {...register("descricao")}
                    placeholder="Descrição breve..."
                    className="w-full px-3 py-2 bg-superficie border border-border rounded-lg text-foreground placeholder-slate-500 focus:outline-none focus:border-brand-500/50 transition-colors text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground-suave mb-2">Cor</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {CORES_PRESET.map((cor) => (
                      <button
                        key={cor}
                        type="button"
                        onClick={() => { setCorSelecionada(cor); setValue("cor", cor); }}
                        className={`w-6 h-6 rounded-full transition-all ${
                          corSelecionada === cor ? "ring-2 ring-white ring-offset-2 ring-offset-[#0d1117] scale-110" : "hover:scale-105"
                        }`}
                        style={{ backgroundColor: cor }}
                      />
                    ))}
                    <input
                      type="color"
                      value={corSelecionada}
                      onChange={(e) => { setCorSelecionada(e.target.value); setValue("cor", e.target.value); }}
                      className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                      title="Cor personalizada"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setEditando(null); reset(); }}
                    className="flex-1 px-3 py-2 rounded-lg border border-border text-foreground-suave hover:text-foreground hover:bg-superficie transition-colors text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {editando ? "Salvar" : "Criar"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        {!showForm && (
          <div className="p-4 border-t border-border flex-shrink-0">
            <button
              onClick={handleNovaCategoria}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-brand-500/50 hover:bg-brand-500/5 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Nova Categoria
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!categoriaParaExcluir}
        titulo="Excluir categoria"
        mensagem={
          <>
            Excluir a categoria{" "}
            <span className="text-foreground font-medium">
              {categoriaParaExcluir?.nome}
            </span>
            ? Produtos vinculados perderão a categoria.
          </>
        }
        confirmLabel="Excluir"
        processando={excluindo}
        onConfirm={handleConfirmarExclusao}
        onCancel={() => setCategoriaParaExcluir(null)}
      />
    </div>
  );
}
