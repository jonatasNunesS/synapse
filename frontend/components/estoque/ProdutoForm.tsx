"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Loader2 } from "lucide-react";
import type { ProdutoDetail, CategoriaEstoque } from "@/types/estoque";

const schema = z.object({
  nome: z.string().min(1, "Nome é obrigatório").max(255),
  descricao: z.string().optional(),
  sku: z.string().max(100).optional(),
  codigo_barras: z.string().max(50).optional(),
  unidade: z.enum([
    "unidade", "kg", "g", "litro", "ml", "metro", "cm", "caixa", "pacote", "par",
  ]),
  preco_custo: z.number({ message: "Informe um valor válido" }).min(0, "Deve ser maior ou igual a 0"),
  preco_venda: z.number({ message: "Informe um valor válido" }).min(0, "Deve ser maior ou igual a 0"),
  estoque_minimo: z.number({ message: "Informe um valor válido" }).min(0),
  estoque_maximo: z.number({ message: "Informe um valor válido" }).min(0).optional().nullable(),
  categoria: z.string().optional().nullable(),
  imagem_url: z.string().url("URL inválida").optional().or(z.literal("")),
});

type FormData = z.infer<typeof schema>;

interface ProdutoFormProps {
  produto?: ProdutoDetail | null;
  categorias: CategoriaEstoque[];
  onSubmit: (dados: FormData) => Promise<void>;
  onFechar: () => void;
  loading?: boolean;
  erro?: string | null;
}

const UNIDADES = [
  { value: "unidade", label: "Unidade" },
  { value: "kg", label: "Quilograma (kg)" },
  { value: "g", label: "Grama (g)" },
  { value: "litro", label: "Litro" },
  { value: "ml", label: "Mililitro (ml)" },
  { value: "metro", label: "Metro" },
  { value: "cm", label: "Centímetro (cm)" },
  { value: "caixa", label: "Caixa" },
  { value: "pacote", label: "Pacote" },
  { value: "par", label: "Par" },
];

export function ProdutoForm({
  produto,
  categorias,
  onSubmit,
  onFechar,
  loading,
  erro,
}: ProdutoFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: "",
      descricao: "",
      sku: "",
      codigo_barras: "",
      unidade: "unidade",
      preco_custo: 0,
      preco_venda: 0,
      estoque_minimo: 0,
      estoque_maximo: null,
      categoria: null,
      imagem_url: "",
    },
  });

  useEffect(() => {
    if (produto) {
      reset({
        nome: produto.nome,
        descricao: produto.descricao || "",
        sku: produto.sku || "",
        codigo_barras: produto.codigo_barras || "",
        unidade: produto.unidade,
        preco_custo: Number(produto.preco_custo),
        preco_venda: Number(produto.preco_venda),
        estoque_minimo: Number(produto.estoque_minimo),
        estoque_maximo: produto.estoque_maximo
          ? Number(produto.estoque_maximo)
          : null,
        categoria: produto.categoria || null,
        imagem_url: produto.imagem_url || "",
      });
    }
  }, [produto, reset]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onFechar}
      />
      <div className="relative bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-[#0d1117] z-10">
          <h2 className="text-lg font-semibold text-white">
            {produto ? "Editar Produto" : "Novo Produto"}
          </h2>
          <button
            onClick={onFechar}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          {erro && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {erro}
            </div>
          )}

          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Nome <span className="text-red-400">*</span>
            </label>
            <input
              {...register("nome")}
              placeholder="Ex: Camisa Preta G"
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition-colors text-sm"
            />
            {errors.nome && (
              <p className="mt-1 text-xs text-red-400">{errors.nome.message}</p>
            )}
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Descrição
            </label>
            <textarea
              {...register("descricao")}
              rows={2}
              placeholder="Descrição opcional do produto..."
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors text-sm resize-none"
            />
          </div>

          {/* SKU + Código de Barras */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                SKU
              </label>
              <input
                {...register("sku")}
                placeholder="Ex: CAM-001"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Código de Barras
              </label>
              <input
                {...register("codigo_barras")}
                placeholder="Ex: 7891234567890"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors text-sm font-mono"
              />
            </div>
          </div>

          {/* Unidade + Categoria */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Unidade
              </label>
              <select
                {...register("unidade")}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
              >
                {UNIDADES.map((u) => (
                  <option key={u.value} value={u.value} className="bg-[#0d1117]">
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Categoria
              </label>
              <select
                {...register("categoria")}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
              >
                <option value="" className="bg-[#0d1117]">
                  Sem categoria
                </option>
                {categorias.map((cat) => (
                  <option key={cat.id} value={cat.id} className="bg-[#0d1117]">
                    {cat.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Preços */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Preço de Custo (R$)
              </label>
              <input
                {...register("preco_custo", { valueAsNumber: true })}
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
              />
              {errors.preco_custo && (
                <p className="mt-1 text-xs text-red-400">
                  {errors.preco_custo.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Preço de Venda (R$)
              </label>
              <input
                {...register("preco_venda", { valueAsNumber: true })}
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
              />
              {errors.preco_venda && (
                <p className="mt-1 text-xs text-red-400">
                  {errors.preco_venda.message}
                </p>
              )}
            </div>
          </div>

          {/* Estoque Mínimo + Máximo */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Estoque Mínimo
              </label>
              <input
                {...register("estoque_minimo", { valueAsNumber: true })}
                type="number"
                step="0.001"
                min="0"
                placeholder="0"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Estoque Máximo{" "}
                <span className="text-slate-500 text-xs">(opcional)</span>
              </label>
              <input
                {...register("estoque_maximo", { valueAsNumber: true })}
                type="number"
                step="0.001"
                min="0"
                placeholder="Sem limite"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
              />
            </div>
          </div>

          {/* URL da Imagem */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              URL da Imagem{" "}
              <span className="text-slate-500 text-xs">(opcional)</span>
            </label>
            <input
              {...register("imagem_url")}
              type="url"
              placeholder="https://..."
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
            />
            {errors.imagem_url && (
              <p className="mt-1 text-xs text-red-400">
                {errors.imagem_url.message}
              </p>
            )}
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onFechar}
              className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {produto ? "Salvar Alterações" : "Cadastrar Produto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
