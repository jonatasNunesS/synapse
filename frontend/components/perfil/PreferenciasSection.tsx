"use client";
/**
 * Perfil → Suas preferências (tamanho do texto).
 *
 * É preferência PESSOAL: qualquer perfil ajusta o seu, e ninguém mais vê a
 * diferença. Cada opção é renderizada no próprio tamanho, para a pessoa
 * comparar antes de escolher.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Type } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import type { Usuario } from "@/types/auth";
import {
  TAMANHOS,
  aplicarTamanhoNoDocumento,
  salvarTamanhoNoCookie,
  tamanhoValido,
  type TamanhoFonte,
} from "@/lib/preferencias";

export function PreferenciasSection() {
  const usuario = useAppStore((s) => s.usuario);
  const setUsuario = useAppStore((s) => s.setUsuario);

  const [tamanho, setTamanho] = useState<TamanhoFonte>(() =>
    tamanhoValido(usuario?.tamanho_fonte)
  );
  const [salvando, setSalvando] = useState(false);

  // O usuário chega no /auth/me: quando carrega, a seleção acompanha.
  useEffect(() => {
    setTamanho(tamanhoValido(usuario?.tamanho_fonte));
  }, [usuario?.tamanho_fonte]);

  const mudou = tamanho !== tamanhoValido(usuario?.tamanho_fonte);

  const salvar = async () => {
    if (salvando) return;
    setSalvando(true);
    try {
      const resp = await api.patch<{ tamanho_fonte: TamanhoFonte }>(
        "/auth/me/preferencias/",
        { tamanho_fonte: tamanho }
      );
      const salvo = resp.data?.tamanho_fonte;
      if (salvo) {
        // Aplica na hora, sem reload, e guarda para o próximo carregamento.
        aplicarTamanhoNoDocumento(salvo);
        salvarTamanhoNoCookie(salvo);
        if (usuario) {
          setUsuario({ ...usuario, tamanho_fonte: salvo } as Usuario);
        }
      }
      toast.success("Tamanho do texto atualizado");
    } catch (err) {
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="bg-[#0d1117] border border-white/10 rounded-xl p-6">
      <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
        <Type className="w-4 h-4 text-brand-400" />
        Suas preferências
      </h2>
      <p className="text-xs text-slate-500 mb-5">
        Só você vê essas mudanças — elas não afetam o resto da equipe.
      </p>

      <p className="text-xs font-medium text-slate-400 mb-2">Tamanho do texto</p>
      <div
        role="radiogroup"
        aria-label="Tamanho do texto"
        className="space-y-2"
      >
        {TAMANHOS.map((t) => {
          const selecionado = t.id === tamanho;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={selecionado}
              aria-label={t.nome}
              onClick={() => setTamanho(t.id)}
              className={`w-full flex items-center justify-between gap-4 rounded-lg border p-3 text-left transition-all ${
                selecionado
                  ? "border-brand-500 bg-white/5"
                  : "border-white/10 hover:border-white/25"
              }`}
            >
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-white">{t.nome}</span>
                  {selecionado && <Check className="w-3.5 h-3.5 text-brand-400" />}
                </span>
                <span className="block text-[0.6875rem] text-slate-500">
                  {t.descricao}
                </span>
              </span>
              {/* Cada opção aparece no tamanho que ela aplica: 0.875rem
                  (o text-sm da interface) vezes a escala do nível. */}
              <span
                className="text-slate-200 flex-shrink-0"
                style={{ fontSize: `${(0.875 * parseFloat(t.escala)) / 100}rem` }}
              >
                Aa<span className="hidden sm:inline"> — saldo do mês</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={salvar}
          disabled={salvando || !mudou}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
          Salvar
        </button>
        {mudou && (
          <span className="text-xs text-slate-500">
            Salve para o sistema inteiro passar a usar esse tamanho.
          </span>
        )}
      </div>
    </section>
  );
}
