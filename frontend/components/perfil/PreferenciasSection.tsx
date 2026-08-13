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
import { Check, Loader2, Monitor, Moon, Sun, Type } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import type { Usuario } from "@/types/auth";
import {
  MODOS,
  TAMANHOS,
  aplicarModoNoDocumento,
  aplicarTamanhoNoDocumento,
  modoValido,
  salvarModoNoCookie,
  salvarTamanhoNoCookie,
  tamanhoValido,
  type TamanhoFonte,
  type TemaModo,
} from "@/lib/preferencias";

const ICONE_DO_MODO = { claro: Sun, escuro: Moon, sistema: Monitor } as const;

/**
 * Miniatura da tela em cada modo: barra lateral, cabeçalho e dois blocos de
 * conteúdo. As cores são fixas de propósito — o card precisa mostrar como o
 * modo FICA, mesmo quando não é o que está valendo agora.
 */
function PreviaDoModo({ modo }: { modo: TemaModo }) {
  const claro = { fundo: "#F9F9FB", card: "#FFFFFF", traco: "#D8D8DE" };
  const escuro = { fundo: "#0A0A14", card: "#12121C", traco: "#2A2A38" };

  const faixa = (c: typeof claro, largura: string) => (
    <span
      className="block h-1 rounded-full"
      style={{ background: c.traco, width: largura }}
    />
  );

  const painel = (c: typeof claro, metade?: boolean) => (
    <span
      className={`flex gap-1 overflow-hidden rounded ${metade ? "w-1/2" : "w-full"}`}
      style={{ background: c.fundo }}
      aria-hidden
    >
      <span className="w-1/4 py-1 pl-1">
        <span
          className="block h-full rounded-sm"
          style={{ background: c.card }}
        />
      </span>
      <span className="flex flex-1 flex-col justify-center gap-1 py-1 pr-1">
        {faixa(c, "80%")}
        {faixa(c, "55%")}
        {faixa(c, "70%")}
      </span>
    </span>
  );

  // "Sistema" mostra os dois lados, que é exatamente o que ele significa.
  if (modo === "sistema") {
    return (
      <span className="flex h-10 w-full gap-px overflow-hidden rounded border border-border">
        {painel(claro, true)}
        {painel(escuro, true)}
      </span>
    );
  }
  return (
    <span className="flex h-10 w-full overflow-hidden rounded border border-border">
      {painel(modo === "claro" ? claro : escuro)}
    </span>
  );
}

export function PreferenciasSection() {
  const usuario = useAppStore((s) => s.usuario);
  const setUsuario = useAppStore((s) => s.setUsuario);

  const [tamanho, setTamanho] = useState<TamanhoFonte>(() =>
    tamanhoValido(usuario?.tamanho_fonte)
  );
  const [salvando, setSalvando] = useState(false);

  const modo = modoValido(usuario?.tema_modo);
  const [trocandoModo, setTrocandoModo] = useState(false);

  // O usuário chega no /auth/me: quando carrega, a seleção acompanha.
  useEffect(() => {
    setTamanho(tamanhoValido(usuario?.tamanho_fonte));
  }, [usuario?.tamanho_fonte]);

  const mudou = tamanho !== tamanhoValido(usuario?.tamanho_fonte);

  /**
   * Aparência aplica na hora, sem botão: a mudança é a tela inteira, então a
   * própria troca já é a confirmação — e desfazer custa um clique. O tamanho
   * do texto, logo abaixo, continua com Salvar porque ali a comparação entre
   * os níveis é o ponto.
   */
  const escolherModo = async (novo: TemaModo) => {
    if (trocandoModo || novo === modo) return;
    const anterior = modo;

    setTrocandoModo(true);
    aplicarModoNoDocumento(novo);
    salvarModoNoCookie(novo);
    if (usuario) setUsuario({ ...usuario, tema_modo: novo } as Usuario);

    try {
      await api.patch("/auth/me/preferencias/", { tema_modo: novo });
      toast.success("Aparência atualizada");
    } catch (err) {
      // Não gravou no servidor: volta tudo, senão o próximo login desmente
      // o que a pessoa está vendo.
      aplicarModoNoDocumento(anterior);
      salvarModoNoCookie(anterior);
      if (usuario) setUsuario({ ...usuario, tema_modo: anterior } as Usuario);
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setTrocandoModo(false);
    }
  };

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
    <section className="bg-card border border-border rounded-xl p-6 shadow-elevacao">
      <h2 className="text-base font-semibold text-foreground mb-1 flex items-center gap-2">
        <Type className="w-4 h-4 text-brand-accent" />
        Suas preferências
      </h2>
      <p className="text-xs text-muted-foreground mb-5">
        Só você vê essas mudanças — elas não afetam o resto da equipe.
      </p>

      {/* ── Aparência ──────────────────────────────────────── */}
      <p className="text-xs font-medium text-muted-foreground mb-2">Aparência</p>
      <div
        role="radiogroup"
        aria-label="Aparência"
        className="grid grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] gap-2.5"
      >
        {MODOS.map((m) => {
          const selecionado = m.id === modo;
          const Icone = ICONE_DO_MODO[m.id];
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={selecionado}
              aria-label={m.nome}
              disabled={trocandoModo}
              onClick={() => escolherModo(m.id)}
              className={`rounded-lg border p-2.5 text-left transition-all disabled:cursor-not-allowed ${
                selecionado
                  ? "border-brand-500 bg-superficie ring-1 ring-brand-500/40"
                  : "border-border hover:border-muted-foreground/40"
              }`}
            >
              <PreviaDoModo modo={m.id} />
              <span className="mt-2 flex items-center gap-1.5">
                <Icone className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {m.nome}
                </span>
                {selecionado && (
                  <Check className="w-3.5 h-3.5 text-brand-accent" />
                )}
              </span>
              <span className="block text-[0.6875rem] text-muted-foreground">
                {m.descricao}
              </span>
            </button>
          );
        })}
      </div>

      <hr className="my-6 border-border" />

      {/* ── Tamanho do texto ───────────────────────────────── */}
      <p className="text-xs font-medium text-muted-foreground mb-2">
        Tamanho do texto
      </p>
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
                  ? "border-brand-500 bg-superficie"
                  : "border-border hover:border-muted-foreground/40"
              }`}
            >
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-foreground">
                    {t.nome}
                  </span>
                  {selecionado && (
                    <Check className="w-3.5 h-3.5 text-brand-accent" />
                  )}
                </span>
                <span className="block text-[0.6875rem] text-muted-foreground">
                  {t.descricao}
                </span>
              </span>
              {/* Cada opção aparece no tamanho que ela aplica: 0.875rem
                  (o text-sm da interface) vezes a escala do nível. */}
              <span
                className="text-foreground/85 flex-shrink-0"
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
          <span className="text-xs text-muted-foreground">
            Salve para o sistema inteiro passar a usar esse tamanho.
          </span>
        )}
      </div>
    </section>
  );
}
