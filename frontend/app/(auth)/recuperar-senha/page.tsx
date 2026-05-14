"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, CheckCircle, Loader2, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getErrorMessage } from "@/lib/api";

const schema = z.object({
  email: z.string().email("E-mail inválido."),
});

type FormData = z.infer<typeof schema>;

export default function RecuperarSenhaPage() {
  const { recuperarSenha } = useAuth();
  const [enviado, setEnviado] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      await recuperarSenha({ email: data.email });
      setEnviado(true);
    } catch (err) {
      setServerError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <div className="w-9 h-9 rounded-lg bg-violet-600 flex items-center justify-center">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <span className="text-2xl font-bold text-white tracking-tight">Synapse</span>
      </div>

      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">
        {enviado ? (
          /* Estado de sucesso */
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-emerald-400" />
            </div>
            <h1 className="text-xl font-semibold text-white mb-2">E-mail enviado!</h1>
            <p className="text-sm text-slate-400 mb-6">
              Se o endereço{" "}
              <span className="text-white font-medium">{getValues("email")}</span>{" "}
              estiver cadastrado, você receberá as instruções em breve.
            </p>
            <p className="text-xs text-slate-500 mb-6">
              Verifique também sua caixa de spam.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar para o login
            </Link>
          </div>
        ) : (
          /* Formulário */
          <>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors mb-5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar
            </Link>

            <h1 className="text-xl font-semibold text-white mb-1">Recuperar senha</h1>
            <p className="text-sm text-slate-400 mb-6">
              Informe seu e-mail e enviaremos um link para redefinir sua senha.
            </p>

            {serverError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  E-mail cadastrado
                </label>
                <input
                  {...register("email")}
                  type="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  className={`w-full px-3.5 py-2.5 rounded-lg bg-slate-900/60 border text-white placeholder-slate-500 text-sm
                    focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-colors
                    ${errors.email ? "border-red-500/60" : "border-slate-700/60 focus:border-violet-500/60"}`}
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50
                  text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar link de recuperação"
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
