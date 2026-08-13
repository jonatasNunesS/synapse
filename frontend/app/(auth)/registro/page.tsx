"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Eye, EyeOff, Loader2, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getErrorMessage } from "@/lib/api";
import { SEGMENTOS } from "@/types/auth";
import type { ModuloOpcional } from "@/types/auth";
import {
  PERGUNTAS,
  PerguntasModulos,
  type RespostasModulos,
} from "@/components/auth/PerguntasModulos";

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

const CAMPOS_ETAPA_1: (keyof RegistroForm)[] = [
  "nome_usuario",
  "email",
  "senha",
  "confirmar_senha",
];
const CAMPOS_ETAPA_2: (keyof RegistroForm)[] = ["nome_empresa", "segmento"];
const TOTAL_ETAPAS = 3;

// ════════════════════════════════════════════════════════════
// COMPONENTE — cadastro em 3 etapas
// ════════════════════════════════════════════════════════════

export default function RegistroPage() {
  const { registro } = useAuth();
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [respostas, setRespostas] = useState<RespostasModulos>({});

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm<RegistroForm>({
    resolver: zodResolver(registroSchema),
    mode: "onTouched",
  });

  const todasRespondidas = PERGUNTAS.every((p) => respostas[p.modulo] !== undefined);

  const avancar = async () => {
    setServerError(null);
    const campos = etapa === 1 ? CAMPOS_ETAPA_1 : CAMPOS_ETAPA_2;
    const ok = await trigger(campos);
    if (ok) setEtapa((e) => (e === 1 ? 2 : 3));
  };

  const responder = (modulo: ModuloOpcional, valor: boolean) =>
    setRespostas((r) => ({ ...r, [modulo]: valor }));

  const onSubmit = async (data: RegistroForm) => {
    // Trava: só envia com as 6 perguntas respondidas.
    if (!todasRespondidas) return;
    setServerError(null);
    setIsSubmitting(true);
    try {
      await registro({
        ...data,
        // As respostas viram a configuração de módulos da empresa.
        modulo_estoque: respostas.estoque,
        modulo_fornecedores: respostas.fornecedores,
        modulo_projetos: respostas.projetos,
        modulo_agenda: respostas.agenda,
        modulo_equipe: respostas.equipe,
        modulo_documentos: respostas.documentos,
      });
    } catch (err) {
      setServerError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = (hasError: boolean) =>
    `w-full px-3.5 py-2.5 rounded-lg bg-card/60 border text-white placeholder-slate-500 text-sm
    focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-colors
    ${hasError ? "border-red-500/60" : "border-border/60 focus:border-brand-500/60"}`;

  const TITULOS: Record<number, { titulo: string; sub: string }> = {
    1: { titulo: "Sua conta", sub: "Comece gratuitamente. Sem cartão de crédito." },
    2: { titulo: "Sua empresa", sub: "Como devemos chamar o seu negócio?" },
    3: {
      titulo: "Como você trabalha",
      sub: "Suas respostas configuram o Synapse pro seu negócio.",
    },
  };

  return (
    <div className="w-full max-w-lg">
      {/* Logo */}
      <div className="flex items-center justify-center gap-2 mb-8">
        <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <span className="text-2xl font-bold text-foreground tracking-tight">Synapse</span>
      </div>

      {/* Card */}
      <div className="bg-secondary/60 border border-border/50 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">
        {/* Progresso */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-brand-accent">
              Etapa {etapa} de {TOTAL_ETAPAS}
            </span>
            {etapa > 1 && (
              <button
                type="button"
                onClick={() => setEtapa((e) => (e === 3 ? 2 : 1))}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground-suave transition-colors"
              >
                <ArrowLeft className="w-3 h-3" />
                Voltar
              </button>
            )}
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-700/60 overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-600 transition-all duration-300"
              style={{ width: `${(etapa / TOTAL_ETAPAS) * 100}%` }}
            />
          </div>
        </div>

        <h1 className="text-xl font-semibold text-foreground mb-1">{TITULOS[etapa].titulo}</h1>
        <p className="text-sm text-muted-foreground mb-6">{TITULOS[etapa].sub}</p>

        {serverError && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-erro text-sm">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* ── ETAPA 1: Sua conta ───────────────────────────── */}
          <div className={etapa === 1 ? "space-y-4" : "hidden"}>
            <div>
              <label className="block text-sm font-medium text-foreground-suave mb-1.5">
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
                <p className="mt-1 text-xs text-erro">{errors.nome_usuario.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground-suave mb-1.5">
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
                <p className="mt-1 text-xs text-erro">{errors.email.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground-suave mb-1.5">
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-suave hover:text-foreground-suave"
                    aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.senha && (
                  <p className="mt-1 text-xs text-erro">{errors.senha.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground-suave mb-1.5">
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-suave hover:text-foreground-suave"
                    aria-label={showConfirm ? "Esconder senha" : "Mostrar senha"}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmar_senha && (
                  <p className="mt-1 text-xs text-erro">{errors.confirmar_senha.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* ── ETAPA 2: Sua empresa ─────────────────────────── */}
          <div className={etapa === 2 ? "space-y-4" : "hidden"}>
            <div>
              <label className="block text-sm font-medium text-foreground-suave mb-1.5">
                Nome da empresa
              </label>
              <input
                {...register("nome_empresa")}
                type="text"
                placeholder="Minha Empresa LTDA"
                className={inputClass(!!errors.nome_empresa)}
              />
              {errors.nome_empresa && (
                <p className="mt-1 text-xs text-erro">{errors.nome_empresa.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground-suave mb-1.5">
                Segmento
              </label>
              <select
                {...register("segmento")}
                className={inputClass(!!errors.segmento) + " cursor-pointer"}
                defaultValue=""
              >
                <option value="" disabled className="bg-card">
                  Selecione seu segmento...
                </option>
                {SEGMENTOS.map((s) => (
                  <option key={s.value} value={s.value} className="bg-card">
                    {s.label}
                  </option>
                ))}
              </select>
              {errors.segmento && (
                <p className="mt-1 text-xs text-erro">{errors.segmento.message}</p>
              )}
            </div>
          </div>

          {/* ── ETAPA 3: Como você trabalha ──────────────────── */}
          <div className={etapa === 3 ? "block" : "hidden"}>
            <PerguntasModulos respostas={respostas} onResponder={responder} />
            {!todasRespondidas && (
              <p className="mt-4 text-xs text-muted-suave">
                Responda todas as perguntas para continuar.
              </p>
            )}
          </div>

          {/* ── Ações ────────────────────────────────────────── */}
          {etapa < 3 ? (
            <button
              type="button"
              onClick={avancar}
              className="w-full py-2.5 px-4 rounded-lg bg-brand-600 hover:bg-brand-500
                text-white font-medium text-sm transition-colors mt-2"
            >
              Continuar
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting || !todasRespondidas}
              className="w-full py-2.5 px-4 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:bg-brand-600/40
                disabled:cursor-not-allowed text-white font-medium text-sm transition-colors
                flex items-center justify-center gap-2 mt-2"
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
          )}

          <p className="text-xs text-muted-suave text-center">
            Ao criar uma conta, você concorda com nossos{" "}
            <span className="text-brand-accent">Termos de Uso</span> e{" "}
            <span className="text-brand-accent">Política de Privacidade</span>.
          </p>
        </form>

        <p className="mt-5 text-center text-sm text-muted-suave">
          Já tem uma conta?{" "}
          <Link
            href="/login"
            className="text-brand-accent hover:text-brand-accent font-medium transition-colors"
          >
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  );
}
