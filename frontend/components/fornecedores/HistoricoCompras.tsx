"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X, Loader2, ShoppingCart, ChevronLeft, ChevronRight } from "lucide-react";
import { useComprasFornecedor } from "@/hooks/useFornecedores";
import type { CompraFornecedor } from "@/types/fornecedores";

const STATUS_COMPRA: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  pago: { label: "Pago", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  cancelado: { label: "Cancelado", color: "bg-red-500/15 text-red-400 border-red-500/30" },
};

function formatCurrency(value: string | number) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
}

const compraSchema = z.object({
  descricao: z.string({ message: "Descrição é obrigatória" }).min(3, "Mínimo 3 caracteres"),
  valor: z.number({ message: "Informe o valor" }).positive("Valor deve ser positivo"),
  data_compra: z.string({ message: "Data é obrigatória" }).min(1, "Data é obrigatória"),
  numero_nf: z.string().optional(),
  status: z.enum(["pendente", "pago", "cancelado"]),
  data_pagamento: z.string().optional(),
  observacoes: z.string().optional(),
});

type CompraFormValues = z.infer<typeof compraSchema>;

interface NovaCompraFormProps {
  fornecedorId: string;
  onSuccess: () => void;
  onClose: () => void;
}

function NovaCompraForm({ fornecedorId, onSuccess, onClose }: NovaCompraFormProps) {
  const { criar } = useComprasFornecedor();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CompraFormValues>({
    resolver: zodResolver(compraSchema),
    defaultValues: {
      status: "pendente",
      data_compra: new Date().toISOString().split("T")[0],
    },
  });

  const statusWatch = watch("status");

  const onSubmit = async (values: CompraFormValues) => {
    setServerError(null);
    try {
      const payload = Object.fromEntries(
        Object.entries(values).filter(([, v]) => v !== "" && v !== undefined)
      ) as CompraFormValues;
      await criar(fornecedorId, payload);
      onSuccess();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setServerError(e?.response?.data?.error?.message ?? "Erro ao registrar compra");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h3 className="text-base font-semibold text-white">Registrar Compra</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6">
          {serverError && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {serverError}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-zinc-400">Descrição *</label>
              <input {...register("descricao")} placeholder="Descrição da compra" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500/50" />
              {errors.descricao && <p className="mt-1 text-xs text-red-400">{errors.descricao.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Valor *</label>
              <input {...register("valor", { valueAsNumber: true })} type="number" step="0.01" placeholder="0,00" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500/50" />
              {errors.valor && <p className="mt-1 text-xs text-red-400">{errors.valor.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Data da Compra *</label>
              <input {...register("data_compra")} type="date" className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50" />
              {errors.data_compra && <p className="mt-1 text-xs text-red-400">{errors.data_compra.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Nº Nota Fiscal</label>
              <input {...register("numero_nf")} placeholder="NF-001" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">Status</label>
              <select {...register("status")} className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50">
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            {statusWatch === "pago" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Data de Pagamento</label>
                <input {...register("data_pagamento")} type="date" className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50" />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-zinc-400">Observações</label>
              <textarea {...register("observacoes")} rows={2} placeholder="Observações adicionais..." className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500/50" />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-400 hover:bg-white/5 hover:text-white">
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-60">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Registrar Compra
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface HistoricoComprasProps {
  fornecedorId: string;
}

export function HistoricoCompras({ fornecedorId }: HistoricoComprasProps) {
  const { data, total, loading, error, fetch } = useComprasFornecedor();
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const pageSize = 25;

  useEffect(() => {
    fetch(fornecedorId, page);
  }, [fetch, fornecedorId, page]);

  const totalPages = Math.ceil(total / pageSize);

  const handleSuccess = () => {
    setShowForm(false);
    fetch(fornecedorId, page);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-white">Histórico de Compras</h3>
          {total > 0 && (
            <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-xs text-violet-400">
              {total}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg bg-violet-600/20 px-3 py-1.5 text-xs font-medium text-violet-400 transition-colors hover:bg-violet-600/30"
        >
          <Plus className="h-3.5 w-3.5" />
          Registrar Compra
        </button>
      </div>

      {/* List */}
      <div className="divide-y divide-white/5">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-zinc-500">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
            Carregando...
          </div>
        )}
        {!loading && error && (
          <p className="py-6 text-center text-sm text-red-400">{error}</p>
        )}
        {!loading && !error && data.length === 0 && (
          <div className="py-10 text-center">
            <ShoppingCart className="mx-auto mb-2 h-8 w-8 text-zinc-700" />
            <p className="text-sm text-zinc-500">Nenhuma compra registrada.</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-xs text-violet-400 hover:text-violet-300"
            >
              Registrar primeira compra
            </button>
          </div>
        )}
        {!loading && data.map((c: CompraFornecedor) => {
          const status = STATUS_COMPRA[c.status] ?? { label: c.status, color: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" };
          return (
            <div key={c.id} className="flex items-start justify-between px-5 py-3.5 transition-colors hover:bg-white/5">
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{c.descricao}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span>{new Date(c.data_compra).toLocaleDateString("pt-BR")}</span>
                  {c.numero_nf && <span>NF: {c.numero_nf}</span>}
                  {c.criado_por_nome && <span>por {c.criado_por_nome}</span>}
                </div>
                {c.observacoes && (
                  <p className="mt-1 text-xs text-zinc-600">{c.observacoes}</p>
                )}
              </div>
              <div className="ml-4 flex flex-col items-end gap-1.5">
                <span className="font-mono text-sm font-semibold text-white">
                  {formatCurrency(c.valor)}
                </span>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${status.color}`}>
                  {status.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-white/10 px-5 py-3">
          <span className="text-xs text-zinc-500">{total} compra{total !== 1 ? "s" : ""}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded p-1 text-zinc-400 hover:bg-white/10 disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-zinc-400">{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded p-1 text-zinc-400 hover:bg-white/10 disabled:opacity-40">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <NovaCompraForm
          fornecedorId={fornecedorId}
          onSuccess={handleSuccess}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
