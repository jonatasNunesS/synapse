"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Loader2 } from "lucide-react";
import type { ClienteDetail } from "@/types/clientes";

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  nome: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  tipo: z.enum(["pessoa_fisica", "pessoa_juridica"]),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  telefone: z.string().optional().or(z.literal("")),
  whatsapp: z.string().optional().or(z.literal("")),
  cpf_cnpj: z.string().optional().or(z.literal("")),
  endereco: z.string().optional().or(z.literal("")),
  cidade: z.string().optional().or(z.literal("")),
  estado: z.string().max(2).optional().or(z.literal("")),
  cep: z.string().optional().or(z.literal("")),
  origem: z
    .enum(["indicacao", "instagram", "facebook", "google", "site", "whatsapp", "outro"])
    .optional(),
  status_funil: z
    .enum(["lead", "contato", "proposta", "negociacao", "fechado", "perdido"])
    .optional(),
  observacoes: z.string().optional().or(z.literal("")),
});

type FormData = z.infer<typeof schema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface ClienteFormProps {
  cliente?: ClienteDetail | null;
  onSubmit: (dados: FormData) => Promise<void>;
  onClose: () => void;
  loading?: boolean;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function ClienteForm({ cliente, onSubmit, onClose, loading }: ClienteFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo: "pessoa_fisica",
      status_funil: "lead",
      origem: "outro",
    },
  });

  useEffect(() => {
    if (cliente) {
      reset({
        nome: cliente.nome,
        tipo: cliente.tipo,
        email: cliente.email ?? "",
        telefone: cliente.telefone ?? "",
        whatsapp: cliente.whatsapp ?? "",
        cpf_cnpj: cliente.cpf_cnpj ?? "",
        endereco: cliente.endereco ?? "",
        cidade: cliente.cidade ?? "",
        estado: cliente.estado ?? "",
        cep: cliente.cep ?? "",
        origem: cliente.origem,
        status_funil: cliente.status_funil,
        observacoes: cliente.observacoes ?? "",
      });
    }
  }, [cliente, reset]);

  const inputClass =
    "w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors";
  const labelClass = "block text-xs font-medium text-gray-400 mb-1";
  const errorClass = "text-xs text-red-400 mt-0.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1117] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">
            {cliente ? "Editar Cliente" : "Novo Cliente"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          {/* Nome + Tipo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Nome *</label>
              <input {...register("nome")} placeholder="Nome completo" className={inputClass} />
              {errors.nome && <p className={errorClass}>{errors.nome.message}</p>}
            </div>
            <div>
              <label className={labelClass}>Tipo</label>
              <select {...register("tipo")} className={inputClass}>
                <option value="pessoa_fisica" className="bg-[#0f1117]">
                  Pessoa Física
                </option>
                <option value="pessoa_juridica" className="bg-[#0f1117]">
                  Pessoa Jurídica
                </option>
              </select>
            </div>
          </div>

          {/* E-mail + Telefone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>E-mail</label>
              <input
                {...register("email")}
                type="email"
                placeholder="email@exemplo.com"
                className={inputClass}
              />
              {errors.email && <p className={errorClass}>{errors.email.message}</p>}
            </div>
            <div>
              <label className={labelClass}>Telefone</label>
              <input
                {...register("telefone")}
                placeholder="(11) 99999-9999"
                className={inputClass}
              />
            </div>
          </div>

          {/* WhatsApp + CPF/CNPJ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>WhatsApp</label>
              <input
                {...register("whatsapp")}
                placeholder="(11) 99999-9999"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>CPF / CNPJ</label>
              <input
                {...register("cpf_cnpj")}
                placeholder="000.000.000-00"
                className={inputClass}
              />
            </div>
          </div>

          {/* Status + Origem */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Status no Funil</label>
              <select {...register("status_funil")} className={inputClass}>
                <option value="lead" className="bg-[#0f1117]">Lead</option>
                <option value="contato" className="bg-[#0f1117]">Contato</option>
                <option value="proposta" className="bg-[#0f1117]">Proposta</option>
                <option value="negociacao" className="bg-[#0f1117]">Negociação</option>
                <option value="fechado" className="bg-[#0f1117]">Fechado</option>
                <option value="perdido" className="bg-[#0f1117]">Perdido</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Origem</label>
              <select {...register("origem")} className={inputClass}>
                <option value="indicacao" className="bg-[#0f1117]">Indicação</option>
                <option value="instagram" className="bg-[#0f1117]">Instagram</option>
                <option value="facebook" className="bg-[#0f1117]">Facebook</option>
                <option value="google" className="bg-[#0f1117]">Google</option>
                <option value="site" className="bg-[#0f1117]">Site</option>
                <option value="whatsapp" className="bg-[#0f1117]">WhatsApp</option>
                <option value="outro" className="bg-[#0f1117]">Outro</option>
              </select>
            </div>
          </div>

          {/* Endereço */}
          <div>
            <label className={labelClass}>Endereço</label>
            <input
              {...register("endereco")}
              placeholder="Rua, número, complemento"
              className={inputClass}
            />
          </div>

          {/* Cidade + Estado + CEP */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="col-span-1 sm:col-span-1">
              <label className={labelClass}>Cidade</label>
              <input {...register("cidade")} placeholder="São Paulo" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Estado (UF)</label>
              <input {...register("estado")} placeholder="SP" maxLength={2} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>CEP</label>
              <input {...register("cep")} placeholder="00000-000" className={inputClass} />
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className={labelClass}>Observações</label>
            <textarea
              {...register("observacoes")}
              rows={3}
              placeholder="Informações adicionais sobre o cliente..."
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
              {cliente ? "Salvar Alterações" : "Criar Cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
