"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Loader2, Phone, Mail, Users, MessageCircle, DollarSign, FileText } from "lucide-react";
import type { TipoInteracao } from "@/types/clientes";

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z
  .object({
    tipo: z.enum(["ligacao", "email", "reuniao", "whatsapp", "venda", "outro"]),
    titulo: z.string().min(3, "Título deve ter ao menos 3 caracteres"),
    descricao: z.string().optional().or(z.literal("")),
    valor: z.string().optional().or(z.literal("")),
    data_interacao: z.string().optional().or(z.literal("")),
    proximo_followup: z.string().optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      if (data.tipo === "venda") {
        return data.valor && parseFloat(data.valor) > 0;
      }
      return true;
    },
    { message: "Informe o valor da venda", path: ["valor"] }
  );

type FormData = z.infer<typeof schema>;

// ─── Tipos de interação ───────────────────────────────────────────────────────

const TIPOS: { value: TipoInteracao; label: string; icon: React.ElementType; color: string }[] = [
  { value: "ligacao", label: "Ligação", icon: Phone, color: "text-blue-400 bg-blue-400/10" },
  { value: "email", label: "E-mail", icon: Mail, color: "text-purple-400 bg-purple-400/10" },
  { value: "reuniao", label: "Reunião", icon: Users, color: "text-yellow-400 bg-yellow-400/10" },
  {
    value: "whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
    color: "text-green-400 bg-green-400/10",
  },
  { value: "venda", label: "Venda", icon: DollarSign, color: "text-emerald-400 bg-emerald-400/10" },
  { value: "outro", label: "Outro", icon: FileText, color: "text-gray-400 bg-gray-400/10" },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface InteracaoFormProps {
  onSubmit: (dados: FormData) => Promise<void>;
  onClose: () => void;
  loading?: boolean;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function InteracaoForm({ onSubmit, onClose, loading }: InteracaoFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo: "ligacao",
      data_interacao: new Date().toISOString().slice(0, 16),
    },
  });

  const tipoSelecionado = watch("tipo");

  const inputClass =
    "w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors";
  const labelClass = "block text-xs font-medium text-gray-400 mb-1";
  const errorClass = "text-xs text-red-400 mt-0.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1117] border border-white/10 rounded-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Registrar Interação</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
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
                      ? "border-purple-500 bg-purple-500/10 text-white"
                      : "border-white/10 bg-white/3 text-gray-400 hover:border-white/20"
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
              className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 hover:bg-white/10 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 rounded-lg text-sm text-white font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Registrar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
