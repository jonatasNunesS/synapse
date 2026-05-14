"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Lancamento } from "@/types/financeiro";

const pagarSchema = z.object({
  data_pagamento: z.string().min(1, "Informe a data de pagamento."),
});

type PagarFormData = z.infer<typeof pagarSchema>;

interface PagarModalProps {
  lancamento: Lancamento;
  onConfirmar: (dataPagamento: string) => Promise<void>;
  onClose: () => void;
}

export function PagarModal({ lancamento, onConfirmar, onClose }: PagarModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PagarFormData>({
    resolver: zodResolver(pagarSchema),
    defaultValues: {
      data_pagamento: format(new Date(), "yyyy-MM-dd"),
    },
  });

  const handleFormSubmit = async (data: PagarFormData) => {
    await onConfirmar(data.data_pagamento);
  };

  const valorFormatado = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(lancamento.valor));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Confirmar Pagamento</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 space-y-4">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <p className="text-sm text-slate-300 mb-1">{lancamento.descricao}</p>
            <p className="text-xl font-bold text-emerald-400">{valorFormatado}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Data de Pagamento *
            </label>
            <input
              type="date"
              {...register("data_pagamento")}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
            />
            {errors.data_pagamento && (
              <p className="mt-1 text-xs text-red-400">
                {errors.data_pagamento.message}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-lg border border-white/10 text-sm font-medium text-slate-400 hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-medium text-white transition-colors"
            >
              {isSubmitting ? "Confirmando..." : "Confirmar Pagamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
