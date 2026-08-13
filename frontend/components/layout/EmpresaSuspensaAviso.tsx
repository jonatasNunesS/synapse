"use client";
/**
 * Tela de aviso exibida quando a empresa do usuário está suspensa. O usuário
 * CONSEGUE logar (a sessão é válida), mas não acessa o sistema — só vê este
 * aviso, com opção de sair. Staff da plataforma tem um atalho para o painel.
 */
import { ShieldAlert, LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

export function EmpresaSuspensaAviso() {
  const { usuario, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-card p-8 text-center shadow-xl">
        <div className="mx-auto h-14 w-14 rounded-full bg-red-500/15 text-erro flex items-center justify-center">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-lg font-bold text-foreground">Sua conta está suspensa</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O acesso da sua empresa ao Synapse está temporariamente suspenso. Entre em contato com o
          suporte para regularizar a situação. Seus dados estão preservados.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          {usuario?.is_staff_synapse && (
            <Link
              href="/painel-admin"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-slate-950 text-sm font-medium hover:bg-amber-400 transition-colors"
            >
              <ShieldCheck className="h-4 w-4" />
              Ir para o painel admin
            </Link>
          )}
          <button
            onClick={() => logout()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground-suave text-sm font-medium hover:bg-secondary transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
