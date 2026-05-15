"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Loader2, ArrowDown, ArrowUp, RefreshCw } from "lucide-react";
import type { ProdutoDetail } from "@/types/estoque";

const schema = z.object({
  tipo: z.enum(["entrada", "saida", "ajuste"]),
  quantidade: z.number({ message: "Informe uma quantidade válida" }).positive("A quantidade deve ser maior que zero"),
  motivo: z.enum([
    "compra",
    "venda",
    "devolucao_compra",
    "devolucao_venda",
    "ajuste_manual",
    "perda",
    "transferencia",
    "producao",
    "consumo_interno",
  ]),
  referencia: z.string().max(100).optional(),
  observacoes: z.string().max(500).optional(),
});

// Use the Zod-inferred type for the form (quantidade is number after coerce)
type SchemaType = z.infer<typeof schema>;

// Exported type used by parent pages — omits 'produto' which is injected by the parent
export type MovimentacaoFormData = SchemaType;

interface MovimentacaoFormProps {
  produto: ProdutoDetail;
  onSubmit: (dados: MovimentacaoFormData) => Promise<void>;
  onFechar: () => void;
  loading?: boolean;
  erro?: string | null;
}

const MOTIVOS_POR_TIPO: Record<string, { value: string; label: string }[]> = {
  entrada: [
    { value: "compra", label: "Compra" },
    { value: "devolucao_venda", label: "Devolução de Venda" },
    { value: "producao", label: "Produção" },
    { value: "ajuste_manual", label: "Ajuste Manual" },
  ],
  saida: [
    { value: "venda", label: "Venda" },
    { value: "devolucao_compra", label: "Devolução de Compra" },
    { value: "perda", label: "Perda / Avaria" },
    { value: "consumo_interno", label: "Consumo Interno" },
    { value: "transferencia", label: "Transferência" },
    { value: "ajuste_manual", label: "Ajuste Manual" },
  ],
  ajuste: [
    { value: "ajuste_manual", label: "Ajuste Manual" },
    { value: "transferencia", label: "Transferência" },
  ],
};

export function MovimentacaoForm({
  produto,
  onSubmit,
  onFechar,
  loading,
  erro,
}: MovimentacaoFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SchemaType>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo: "entrada",
      motivo: "compra",
      referencia: "",
      observacoes: "",
    },
  });

  const tipo = watch("tipo");
  const motivos = MOTIVOS_POR_TIPO[tipo] ?? MOTIVOS_POR_TIPO["entrada"];

  const tipoConfig: Record<
    string,
    { label: string; icon: typeof ArrowDown; cor: string; bg: string }
  > = {
    entrada: {
      label: "Entrada",
      icon: ArrowDown,
      cor: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/30",
    },
    saida: {
      label: "Saída",
      icon: ArrowUp,
      cor: "text-red-400",
      bg: "bg-red-500/10 border-red-500/30",
    },
    ajuste: {
      label: "Ajuste",
      icon: RefreshCw,
      cor: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/30",
    },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onFechar}
      />
      <div className="relative bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Registrar Movimentação
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {produto.nome} · Estoque atual:{" "}
              <span className="text-white font-medium">
                {Number(produto.estoque_atual).toLocaleString("pt-BR")}{" "}
                {produto.unidade}
              </span>
            </p>
          </div>
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

          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Tipo de Movimentação <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["entrada", "saida", "ajuste"] as const).map((t) => {
                const config = tipoConfig[t];
                const Icon = config.icon;
                return (
                  <label
                    key={t}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      tipo === t
                        ? config.bg
                        : "border-white/10 hover:border-white/20"
                    }`}
                  >
                    <input
                      {...register("tipo")}
                      type="radio"
                      value={t}
                      className="sr-only"
                    />
                    <Icon
                      className={`h-5 w-5 ${tipo === t ? config.cor : "text-slate-500"}`}
                    />
                    <span
                      className={`text-xs font-medium ${
                        tipo === t ? "text-white" : "text-slate-400"
                      }`}
                    >
                      {config.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Quantidade */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Quantidade <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                {...register("quantidade", { valueAsNumber: true })}
                type="number"
                step="0.001"
                min="0.001"
                placeholder="0"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors text-sm pr-16"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                {produto.unidade}
              </span>
            </div>
            {errors.quantidade && (
              <p className="mt-1 text-xs text-red-400">
                {errors.quantidade.message}
              </p>
            )}
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Motivo <span className="text-red-400">*</span>
            </label>
            <select
              {...register("motivo")}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
            >
              {motivos.map((m) => (
                <option key={m.value} value={m.value} className="bg-[#0d1117]">
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Referência */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Referência{" "}
              <span className="text-slate-500 text-xs">(NF, pedido, etc.)</span>
            </label>
            <input
              {...register("referencia")}
              placeholder="Ex: NF-001, Pedido #123"
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
            />
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Observações
            </label>
            <textarea
              {...register("observacoes")}
              rows={2}
              placeholder="Observações adicionais..."
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors text-sm resize-none"
            />
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-1">
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
              Registrar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
