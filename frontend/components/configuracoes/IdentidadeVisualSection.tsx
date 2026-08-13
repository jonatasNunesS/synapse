"use client";
/**
 * Configurações → Identidade visual (white-label).
 *
 * A empresa escolhe uma paleta e uma fonte de títulos; a escolha vale para
 * TODA a equipe. Só admin altera — os demais veem a configuração atual com os
 * controles desabilitados.
 *
 * A seleção muda o preview na hora (antes de salvar) sem tocar no tema real;
 * ao salvar, o sistema inteiro troca de cor sem recarregar a página.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Palette } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { useModoEfetivo } from "@/hooks/useModoEfetivo";
import { useAppStore } from "@/store/useAppStore";
import type { Usuario } from "@/types/auth";
import {
  FONTES,
  PALETAS,
  aplicarTemaNoDocumento,
  fonteValida,
  infoDaPaleta,
  paletaValida,
  salvarTemaNoCookie,
  type FonteTema,
  type Paleta,
} from "@/lib/tema";

/** Mini-preview: card, botão, badge e texto na paleta/fonte selecionadas. */
function Preview({ paleta, fonte }: { paleta: Paleta; fonte: FonteTema }) {
  const cores = infoDaPaleta(paleta);
  const modo = useModoEfetivo();
  const familiaTitulo =
    FONTES.find((f) => f.id === fonte)?.familiaPreview ?? "inherit";

  // O preview mostra a paleta que a pessoa está experimentando, então não dá
  // para usar os tokens do tema ativo — a cor vem da rampa. E o degrau muda
  // com o modo, igual ao --brand-accent: 400 no escuro, 700 no claro. Sem
  // isso, o texto de destaque sairia lavado sobre o card branco.
  const acento = modo === "claro" ? cores.rampa[700] : cores.rampa[400];

  return (
    <div className="rounded-xl border border-border bg-card/60 p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p
            className="text-base font-semibold text-foreground"
            style={{ fontFamily: familiaTitulo }}
          >
            Resumo do mês
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Assim a equipe vê o sistema.
          </p>
        </div>
        <span
          className="inline-flex items-center rounded-full px-2.5 py-1 text-[0.6875rem] font-medium"
          style={{ background: `${cores.primary}26`, color: acento }}
        >
          Em dia
        </span>
      </div>

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <span
          className="inline-flex items-center rounded-lg px-3.5 py-2 text-sm font-medium text-white"
          style={{ background: cores.primary }}
        >
          Novo lançamento
        </span>
        <span
          className="inline-flex items-center rounded-lg border px-3.5 py-2 text-sm"
          style={{ borderColor: `${cores.primary}66`, color: acento }}
        >
          Ver detalhes
        </span>
        {/* Cores semânticas NÃO mudam com a paleta — ficam aqui de propósito,
            para dar de cara que sucesso/erro seguem verde/vermelho. */}
        <span className="text-sm font-medium text-sucesso">+ R$ 2.800,92</span>
        <span className="text-sm font-medium text-erro">− R$ 320,00</span>
      </div>
    </div>
  );
}

export function IdentidadeVisualSection() {
  const usuario = useAppStore((s) => s.usuario);
  const setUsuario = useAppStore((s) => s.setUsuario);
  const empresa = useAppStore((s) => s.empresa);
  const isAdmin = usuario?.perfil === "admin";

  const [paleta, setPaleta] = useState<Paleta>(() =>
    paletaValida(empresa?.tema_paleta)
  );
  const [fonte, setFonte] = useState<FonteTema>(() =>
    fonteValida(empresa?.tema_fonte)
  );
  const [salvando, setSalvando] = useState(false);

  // A empresa chega no /auth/me: quando ela carrega, a seleção acompanha.
  useEffect(() => {
    setPaleta(paletaValida(empresa?.tema_paleta));
    setFonte(fonteValida(empresa?.tema_fonte));
  }, [empresa?.tema_paleta, empresa?.tema_fonte]);

  const mudou =
    paleta !== paletaValida(empresa?.tema_paleta) ||
    fonte !== fonteValida(empresa?.tema_fonte);

  const salvar = async () => {
    if (!isAdmin || salvando) return;
    setSalvando(true);
    try {
      const resp = await api.patch<{ tema_paleta: Paleta; tema_fonte: FonteTema }>(
        "/auth/empresa/tema/",
        { tema_paleta: paleta, tema_fonte: fonte }
      );
      const salvo = resp.data;
      if (salvo) {
        // Aplica no sistema inteiro sem reload e guarda para o próximo load.
        aplicarTemaNoDocumento(salvo.tema_paleta, salvo.tema_fonte);
        salvarTemaNoCookie(salvo.tema_paleta, salvo.tema_fonte);
        if (usuario?.empresa) {
          setUsuario({
            ...usuario,
            empresa: {
              ...usuario.empresa,
              tema_paleta: salvo.tema_paleta,
              tema_fonte: salvo.tema_fonte,
            },
          } as Usuario);
        }
      }
      toast.success("Identidade visual atualizada.", {
        description: "Toda a equipe vai ver essas cores.",
      });
    } catch (err) {
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="bg-card shadow-elevacao border border-border rounded-xl p-6">
      <h2 className="text-base font-semibold text-foreground mb-1 flex items-center gap-2">
        <Palette className="w-4 h-4 text-brand-accent" />
        Identidade visual
      </h2>
      <p className="text-xs text-muted-suave mb-5">
        Escolha as cores e a fonte que sua equipe vê. Vale para todos os usuários
        da empresa.
      </p>

      {!isAdmin && (
        <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-alerta">
          Só administradores podem alterar a identidade visual.
        </div>
      )}

      {/* ── Paleta ─────────────────────────────────────────── */}
      <p className="text-xs font-medium text-muted-foreground mb-2">Paleta</p>
      <div
        role="radiogroup"
        aria-label="Paleta de cores"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5"
      >
        {PALETAS.map((p) => {
          const selecionada = p.id === paleta;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={selecionada}
              aria-label={p.nome}
              disabled={!isAdmin}
              onClick={() => setPaleta(p.id)}
              className={`relative rounded-lg border p-3 text-left transition-all ${
                selecionada
                  ? "border-brand-500 bg-superficie ring-1 ring-brand-500/40"
                  : "border-border hover:border-border"
              } ${isAdmin ? "cursor-pointer" : "opacity-60 cursor-not-allowed"}`}
            >
              <span className="flex items-center gap-1.5" aria-hidden>
                <span
                  className="h-7 w-7 rounded-md"
                  style={{ background: p.primary }}
                />
                <span
                  className="h-7 w-4 rounded-md"
                  style={{ background: p.primaryHover }}
                />
                <span
                  className="h-7 w-3 rounded-md"
                  style={{ background: p.claro }}
                />
              </span>
              <span className="mt-2 flex items-center gap-1.5">
                <span className="text-sm font-medium text-foreground">{p.nome}</span>
                {selecionada && <Check className="w-3.5 h-3.5 text-brand-accent" />}
              </span>
              <span className="block text-[0.6875rem] text-muted-suave">
                {p.descricao}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Fonte ──────────────────────────────────────────── */}
      <p className="text-xs font-medium text-muted-foreground mt-6 mb-2">
        Fonte dos títulos
      </p>
      <div role="radiogroup" aria-label="Fonte dos títulos" className="space-y-2">
        {FONTES.map((f) => {
          const selecionada = f.id === fonte;
          return (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={selecionada}
              aria-label={f.nome}
              disabled={!isAdmin}
              onClick={() => setFonte(f.id)}
              className={`w-full flex items-center justify-between gap-3 rounded-lg border p-3 text-left transition-all ${
                selecionada
                  ? "border-brand-500 bg-superficie"
                  : "border-border hover:border-border"
              } ${isAdmin ? "cursor-pointer" : "opacity-60 cursor-not-allowed"}`}
            >
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-foreground">{f.nome}</span>
                  {selecionada && <Check className="w-3.5 h-3.5 text-brand-accent" />}
                </span>
                <span className="block text-[0.6875rem] text-muted-suave">
                  {f.descricao}
                </span>
              </span>
              <span
                className="text-lg text-foreground-suave flex-shrink-0"
                style={{ fontFamily: f.familiaPreview }}
              >
                Aa<span className="hidden sm:inline"> — Resumo do mês</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Preview ao vivo ────────────────────────────────── */}
      <p className="text-xs font-medium text-muted-foreground mt-6 mb-2">
        Pré-visualização
      </p>
      <Preview paleta={paleta} fonte={fonte} />

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={salvar}
          disabled={!isAdmin || salvando || !mudou}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
          Salvar
        </button>
        {mudou && isAdmin && (
          <span className="text-xs text-muted-suave">
            A pré-visualização já mostra a mudança; salve para aplicar para a
            equipe.
          </span>
        )}
      </div>
    </section>
  );
}
