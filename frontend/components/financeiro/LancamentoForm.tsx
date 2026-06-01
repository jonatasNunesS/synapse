"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Categoria, LancamentoCreate } from "@/types/financeiro";

const lancamentoSchema = z
  .object({
    tipo: z.enum(["receita", "despesa"]),
    descricao: z
      .string()
      .min(3, "Mínimo 3 caracteres.")
      .max(255, "Máximo 255 caracteres."),
    valor: z
      .string()
      .min(1, "Informe o valor.")
      .refine(
        (v) => !isNaN(parseFloat(v.replace(",", "."))) && parseFloat(v.replace(",", ".")) > 0,
        "O valor deve ser maior que zero."
      ),
    categoria: z.string().optional().nullable(),
    data_vencimento: z.string().optional().nullable(),
    status: z.enum(["pendente", "pago", "atrasado", "cancelado"]),
    data_pagamento: z.string().optional().nullable(),
    recorrente: z.boolean(),
    recorrencia: z.enum(["semanal", "mensal", "anual", ""]),
    observacoes: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.tipo === "despesa" && !data.data_vencimento) return false;
      return true;
    },
    {
      message: "Informe a data de vencimento para despesas.",
      path: ["data_vencimento"],
    }
  )
  .refine(
    (data) => {
      if (data.status === "pago" && !data.data_pagamento) return false;
      return true;
    },
    {
      message: "Informe a data de pagamento quando o status for 'Pago'.",
      path: ["data_pagamento"],
    }
  )
  .refine(
    (data) => {
      if (data.recorrente && !data.recorrencia) return false;
      return true;
    },
    {
      message: "Selecione a periodicidade da recorrência.",
      path: ["recorrencia"],
    }
  );

type LancamentoFormData = z.infer<typeof lancamentoSchema>;

interface LancamentoFormProps {
  categorias: Categoria[];
  onSubmit: (dados: LancamentoCreate) => Promise<void>;
  onClose: () => void;
  loading?: boolean;
}

export function LancamentoForm({
  categorias,
  onSubmit,
  onClose,
  loading,
}: LancamentoFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LancamentoFormData>({
    resolver: zodResolver(lancamentoSchema),
    defaultValues: {
      tipo: "despesa",
      status: "pendente",
      recorrente: false,
      recorrencia: "",
      data_vencimento: format(new Date(), "yyyy-MM-dd"),
      data_pagamento: null,
    },
  });

  const status = watch("status");
  const recorrente = watch("recorrente");
  const tipo = watch("tipo");

  // Filtra categorias pelo tipo selecionado
  const categoriasFiltradas = categorias.filter((c) => c.tipo === tipo);

  const handleFormSubmit = async (data: LancamentoFormData) => {
    const payload: LancamentoCreate = {
      tipo: data.tipo,
      descricao: data.descricao,
      valor: parseFloat(data.valor.replace(",", ".")),
      categoria: data.categoria || null,
      data_vencimento: data.data_vencimento || null,
      status: data.status,
      data_pagamento: data.data_pagamento || null,
      recorrente: data.recorrente,
      recorrencia: data.recorrencia || "",
      observacoes: data.observacoes || "",
    };
    await onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Novo Lançamento</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit(handleFormSubmit)}
          className="p-6 space-y-4 max-h-[70vh] overflow-y-auto"
        >
          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Tipo *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["receita", "despesa"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setValue("tipo", t)}
                  className={`py-2.5 rounded-lg text-sm font-medium transition-all ${
                    tipo === t
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
            {errors.tipo && (
              <p className="mt-1 text-xs text-red-400">{errors.tipo.message}</p>
            )}
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Descrição *
            </label>
            <input
              {...register("descricao")}
              placeholder="Ex: Venda de produto, Aluguel..."
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
            {errors.descricao && (
              <p className="mt-1 text-xs text-red-400">{errors.descricao.message}</p>
            )}
          </div>

          {/* Valor e Categoria */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Valor (R$) *
              </label>
              <input
                {...register("valor")}
                placeholder="0,00"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
              />
              {errors.valor && (
                <p className="mt-1 text-xs text-red-400">{errors.valor.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Categoria
              </label>
              <select
                {...register("categoria")}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
              >
                <option value="">Sem categoria</option>
                {categoriasFiltradas.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Data de Vencimento e Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                {tipo === "despesa" ? "Vencimento *" : "Data de recebimento (opcional)"}
              </label>
              <input
                type="date"
                {...register("data_vencimento")}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
              />
              {errors.data_vencimento && (
                <p className="mt-1 text-xs text-red-400">
                  {errors.data_vencimento.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Status
              </label>
              <select
                {...register("status")}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
              >
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>

          {/* Data de Pagamento (condicional) */}
          {status === "pago" && (
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
          )}

          {/* Recorrência */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="recorrente"
              {...register("recorrente")}
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-violet-500 focus:ring-violet-500"
            />
            <label htmlFor="recorrente" className="text-sm text-slate-300">
              Lançamento recorrente
            </label>
          </div>

          {recorrente && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Periodicidade *
              </label>
              <select
                {...register("recorrencia")}
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
              >
                <option value="">Selecione...</option>
                <option value="semanal">Semanal</option>
                <option value="mensal">Mensal</option>
                <option value="anual">Anual</option>
              </select>
              {errors.recorrencia && (
                <p className="mt-1 text-xs text-red-400">
                  {errors.recorrencia.message}
                </p>
              )}
            </div>
          )}

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Observações
            </label>
            <textarea
              {...register("observacoes")}
              rows={2}
              placeholder="Notas adicionais..."
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors resize-none"
            />
          </div>

          {/* Footer */}
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
              disabled={isSubmitting || loading}
              className="flex-1 py-2.5 px-4 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
            >
              {isSubmitting ? "Salvando..." : "Salvar Lançamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
