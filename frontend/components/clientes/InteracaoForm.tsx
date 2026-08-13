"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Loader2, Phone, Mail, Users, MessageCircle, DollarSign, FileText } from "lucide-react";
import type { TipoInteracao, InteracaoCliente } from "@/types/clientes";
import { getErrorMessage } from "@/lib/api";

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z
  .object({
    tipo: z.enum(["ligacao", "email", "reuniao", "whatsapp", "venda", "outro"]),
    titulo: z.string().min(3, "Título deve ter ao menos 3 caracteres"),
    descricao: z.string().optional().or(z.literal("")),
    valor: z.string().optional().or(z.literal("")),
    data_interacao: z.string().optional().or(z.literal("")),
    proximo_followup: z.string().optional().or(z.literal("")),
    status_pagamento: z
      .enum(["pago", "pendente", "cancelado", "nao_se_aplica"])
      .optional(),
    data_prevista_pagamento: z.string().optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      if (data.tipo === "venda") {
        return data.valor && parseFloat(data.valor) > 0;
      }
      return true;
    },
    { message: "Informe o valor da venda", path: ["valor"] }
  )
  .refine(
    (data) => {
      // Pendente numa interação com valor exige a previsão de pagamento.
      if (data.status_pagamento === "pendente") {
        return !!data.data_prevista_pagamento;
      }
      return true;
    },
    { message: "Informe a previsão de pagamento", path: ["data_prevista_pagamento"] }
  );

type FormData = z.infer<typeof schema>;

// ─── Tipos de interação ───────────────────────────────────────────────────────

const TIPOS: { value: TipoInteracao; label: string; icon: React.ElementType; color: string }[] = [
  { value: "ligacao", label: "Ligação", icon: Phone, color: "text-info bg-blue-400/10" },
  { value: "email", label: "E-mail", icon: Mail, color: "text-brand-accent bg-brand-400/10" },
  { value: "reuniao", label: "Reunião", icon: Users, color: "text-alerta bg-yellow-400/10" },
  {
    value: "whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
    color: "text-sucesso bg-green-400/10",
  },
  { value: "venda", label: "Venda", icon: DollarSign, color: "text-sucesso bg-emerald-400/10" },
  { value: "outro", label: "Outro", icon: FileText, color: "text-muted-foreground bg-gray-400/10" },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface InteracaoFormProps {
  onSubmit: (dados: FormData) => Promise<void>;
  onClose: () => void;
  loading?: boolean;
  /** Quando presente, o formulário entra em modo edição. */
  interacao?: InteracaoCliente | null;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function InteracaoForm({ onSubmit, onClose, loading, interacao }: InteracaoFormProps) {
  const modoEdicao = !!interacao;
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: interacao
      ? {
          tipo: interacao.tipo,
          titulo: interacao.titulo,
          descricao: interacao.descricao ?? "",
          valor: interacao.valor ?? "",
          // ISO → "YYYY-MM-DDTHH:mm" exigido pelo input datetime-local
          data_interacao: interacao.data_interacao?.slice(0, 16) ?? "",
          proximo_followup: interacao.proximo_followup ?? "",
          status_pagamento: interacao.status_pagamento ?? undefined,
          data_prevista_pagamento: interacao.data_prevista_pagamento ?? "",
        }
      : {
          tipo: "ligacao",
          data_interacao: new Date().toISOString().slice(0, 16),
        },
  });

  // Normaliza campos vazios (DRF rejeita "" em datas) e exibe erro do backend
  // sem fechar o modal.
  const submit = async (data: FormData) => {
    setServerError(null);
    const payload: FormData = { ...data };
    if (!payload.proximo_followup) delete payload.proximo_followup;
    if (!payload.data_interacao) delete payload.data_interacao;
    if (!payload.valor) delete payload.valor;
    if (!payload.data_prevista_pagamento) delete payload.data_prevista_pagamento;
    if (!payload.status_pagamento) delete payload.status_pagamento;
    try {
      await onSubmit(payload);
    } catch (err) {
      setServerError(getErrorMessage(err));
    }
  };

  const tipoSelecionado = watch("tipo");
  const statusPagamento = watch("status_pagamento");

  const inputClass =
    "w-full px-3 py-2 bg-superficie border border-border rounded-lg text-sm text-foreground placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-colors";
  const labelClass = "block text-xs font-medium text-muted-foreground mb-1";
  const errorClass = "text-xs text-erro mt-0.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card shadow-elevacao border border-border rounded-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {modoEdicao ? "Editar Interação" : "Registrar Interação"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-superficie-forte rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(submit)} className="p-6 space-y-5">
          {serverError && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-erro">
              {serverError}
            </div>
          )}

          {/* Tipo de interação */}
          <div>
            <label className={labelClass}>Tipo de Interação *</label>
            <div className="grid grid-cols-3 gap-2">
              {TIPOS.map(({ value, label, icon: Icon, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setValue("tipo", value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-xs font-medium ${
                    tipoSelecionado === value
                      ? "border-brand-500 bg-brand-500/10 text-foreground"
                      : "border-border bg-superficie text-muted-foreground hover:border-border"
                  }`}
                >
                  <div className={`p-1.5 rounded-lg ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Título */}
          <div>
            <label className={labelClass}>Título *</label>
            <input
              {...register("titulo")}
              placeholder="Ex: Ligação de apresentação do produto"
              className={inputClass}
            />
            {errors.titulo && <p className={errorClass}>{errors.titulo.message}</p>}
          </div>

          {/* Valor (apenas para venda) */}
          {tipoSelecionado === "venda" && (
            <div>
              <label className={labelClass}>Valor da Venda (R$) *</label>
              <input
                {...register("valor")}
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0,00"
                className={inputClass}
              />
              {errors.valor && <p className={errorClass}>{errors.valor.message}</p>}
            </div>
          )}

          {/* Status de pagamento (interações que envolvem dinheiro) */}
          {tipoSelecionado === "venda" && (
            <div>
              <label className={labelClass}>Status do pagamento</label>
              <div className="grid grid-cols-3 gap-2" role="group" aria-label="Status do pagamento">
                {([
                  ["pago", "Pago"],
                  ["pendente", "Pendente"],
                  ["nao_se_aplica", "N/A"],
                ] as const).map(([value, label]) => {
                  const ativo = statusPagamento === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setValue("status_pagamento", value)}
                      className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                        ativo
                          ? "border-brand-500 bg-brand-500/10 text-foreground"
                          : "border-border bg-superficie text-muted-foreground hover:border-border"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {statusPagamento === "pendente" && (
                <div className="mt-3">
                  <label className={labelClass}>Previsão de pagamento *</label>
                  <input
                    {...register("data_prevista_pagamento")}
                    type="date"
                    aria-label="Previsão de pagamento"
                    className={inputClass}
                  />
                  {errors.data_prevista_pagamento && (
                    <p className={errorClass}>{errors.data_prevista_pagamento.message}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Data + Próximo follow-up */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Data/Hora</label>
              <input
                {...register("data_interacao")}
                type="datetime-local"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Próximo Follow-up</label>
              <input
                {...register("proximo_followup")}
                type="date"
                className={inputClass}
              />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className={labelClass}>Descrição / Anotações</label>
            <textarea
              {...register("descricao")}
              rows={3}
              placeholder="Detalhes da interação..."
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-superficie border border-border rounded-lg text-sm text-foreground-suave hover:bg-superficie-forte transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 rounded-lg text-sm text-white font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {modoEdicao ? "Salvar alterações" : "Registrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
