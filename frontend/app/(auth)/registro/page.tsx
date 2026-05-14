"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getErrorMessage } from "@/lib/api";
import { SEGMENTOS } from "@/types/auth";

// ── Schema de Validação ──────────────────────────────────────

const registroSchema = z
  .object({
    nome_usuario: z
      .string()
      .min(2, "Nome deve ter pelo menos 2 caracteres.")
      .max(100, "Nome muito longo."),
    email: z.string().email("E-mail inválido."),
    senha: z
      .string()
      .min(8, "Senha deve ter pelo menos 8 caracteres.")
      .regex(/[A-Z]/, "Senha deve conter pelo menos uma letra maiúscula.")
      .regex(/[0-9]/, "Senha deve conter pelo menos um número."),
    confirmar_senha: z.string().min(1, "Confirme sua senha."),
    nome_empresa: z
      .string()
      .min(2, "Nome da empresa deve ter pelo menos 2 caracteres.")
      .max(200, "Nome muito longo."),
    segmento: z.string().min(1, "Selecione um segmento."),
  })
  .refine((data) => data.senha === data.confirmar_senha, {
    message: "As senhas não coincidem.",
    path: ["confirmar_senha"],
  });

type RegistroForm = z.infer<typeof registroSchema>;

// ════════════════════════════════════════════════════════════
// COMPONENTE
// ════════════════════════════════════════════════════════════

export default function RegistroPage() {
  const { registro } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegistroForm>({
    resolver: zodResolver(registroSchema),
  });

  const onSubmit = async (data: RegistroForm) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      await registro(data);
    } catch (err) {
      setServerError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = (hasError: boolean) =>
    `w-full px-3.5 py-2.5 rounded-lg bg-slate-900/60 border text-white placeholder-slate-500 text-sm
    focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors
    ${hasError ? "border-red-500/60" : "border-slate-700/60 focus:border-violet-500/60"}`;

  return (
    <div className="w-full max-w-lg">
      {/* Logo */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <div className="w-9 h-9 rounded-lg bg-violet-600 flex items-center justify-center">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <span className="text-2xl font-bold text-white tracking-tight">Synapse</span>
      </div>

      {/* Card */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">
        <h1 className="text-xl font-semibold text-white mb-1">Criar sua conta</h1>
        <p className="text-sm text-slate-400 mb-6">
          Comece gratuitamente. Sem cartão de crédito.
        </p>

        {serverError && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Dados pessoais */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Dados pessoais
            </p>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Seu nome completo
              </label>
              <input
                {...register("nome_usuario")}
                type="text"
                autoComplete="name"
                placeholder="João Silva"
                className={inputClass(!!errors.nome_usuario)}
              />
              {errors.nome_usuario && (
                <p className="mt-1 text-xs text-red-400">{errors.nome_usuario.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                E-mail
              </label>
              <input
                {...register("email")}
                type="email"
                autoComplete="email"
                placeholder="seu@email.com"
                className={inputClass(!!errors.email)}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <input
                    {...register("senha")}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Mín. 8 caracteres"
                    className={inputClass(!!errors.senha) + " pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.senha && (
                  <p className="mt-1 text-xs text-red-400">{errors.senha.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Confirmar senha
                </label>
                <div className="relative">
                  <input
                    {...register("confirmar_senha")}
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Repita a senha"
                    className={inputClass(!!errors.confirmar_senha) + " pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmar_senha && (
                  <p className="mt-1 text-xs text-red-400">{errors.confirmar_senha.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Divisor */}
          <div className="border-t border-slate-700/50 pt-4 space-y-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Sua empresa
            </p>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Nome da empresa
              </label>
              <input
                {...register("nome_empresa")}
                type="text"
                placeholder="Minha Empresa LTDA"
                className={inputClass(!!errors.nome_empresa)}
              />
              {errors.nome_empresa && (
                <p className="mt-1 text-xs text-red-400">{errors.nome_empresa.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Segmento
              </label>
              <select
                {...register("segmento")}
                className={inputClass(!!errors.segmento) + " cursor-pointer"}
                defaultValue=""
              >
                <option value="" disabled className="bg-slate-900">
                  Selecione seu segmento...
                </option>
                {SEGMENTOS.map((s) => (
                  <option key={s.value} value={s.value} className="bg-slate-900">
                    {s.label}
                  </option>
                ))}
              </select>
              {errors.segmento && (
                <p className="mt-1 text-xs text-red-400">{errors.segmento.message}</p>
              )}
            </div>
          </div>

          {/* Botão */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50
              text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 mt-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Criando conta...
              </>
            ) : (
              "Criar conta grátis"
            )}
          </button>

          <p className="text-xs text-slate-500 text-center">
            Ao criar uma conta, você concorda com nossos{" "}
            <span className="text-violet-400">Termos de Uso</span> e{" "}
            <span className="text-violet-400">Política de Privacidade</span>.
          </p>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          Já tem uma conta?{" "}
          <Link
            href="/login"
            className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
          >
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  );
}
