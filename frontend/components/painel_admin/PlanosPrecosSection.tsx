"use client";
/**
 * Painel Administrativo — Planos e Preços.
 *
 * Uma linha por plano comercial com preço mensal/anual, limites e descrição do
 * suporte. Campo vazio = "a definir" (null no backend), que é o que a landing
 * mostra. Só o staff da plataforma chega aqui; o PATCH também é restrito.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Tag } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import type { NomePlano, PlanoPublico } from "@/hooks/usePlanos";

const NOMES: Record<NomePlano, string> = {
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

const inputCls =
  "w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-suave focus:outline-none focus:ring-1 focus:ring-amber-500";
const labelCls = "block text-xs font-medium text-muted-foreground mb-1";

/** null/undefined → "" (campo vazio = a definir). */
function texto(valor: string | number | null | undefined): string {
  return valor === null || valor === undefined ? "" : String(valor);
}

/** "" → null; caso contrário o próprio texto (o backend valida). */
function ouNulo(valor: string): string | null {
  const limpo = valor.trim();
  return limpo === "" ? null : limpo;
}

interface Formulario {
  preco_mensal: string;
  preco_anual: string;
  limite_usuarios: string;
  limite_armazenamento_gb: string;
  descricao_suporte: string;
}

function doPlano(plano: PlanoPublico): Formulario {
  return {
    preco_mensal: texto(plano.preco_mensal),
    preco_anual: texto(plano.preco_anual),
    limite_usuarios: texto(plano.limite_usuarios),
    limite_armazenamento_gb: texto(plano.limite_armazenamento_gb),
    descricao_suporte: plano.descricao_suporte ?? "",
  };
}

export function PlanosPrecosSection() {
  const [planos, setPlanos] = useState<PlanoPublico[]>([]);
  const [formularios, setFormularios] = useState<Record<string, Formulario>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<NomePlano | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const resp = await api.get<PlanoPublico[]>("/planos/");
      const lista = resp.data ?? [];
      setPlanos(lista);
      setFormularios(
        Object.fromEntries(lista.map((p) => [p.plano, doPlano(p)]))
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const editar = (plano: NomePlano, campo: keyof Formulario, valor: string) =>
    setFormularios((f) => ({ ...f, [plano]: { ...f[plano], [campo]: valor } }));

  const salvar = async (plano: NomePlano) => {
    const form = formularios[plano];
    if (!form) return;
    setSalvando(plano);
    try {
      const resp = await api.patch<PlanoPublico>(`/painel-admin/planos/${plano}/`, {
        preco_mensal: ouNulo(form.preco_mensal),
        preco_anual: ouNulo(form.preco_anual),
        limite_usuarios: ouNulo(form.limite_usuarios),
        limite_armazenamento_gb: ouNulo(form.limite_armazenamento_gb),
        descricao_suporte: form.descricao_suporte.trim(),
      });
      const atualizado = resp.data;
      if (atualizado) {
        setPlanos((ps) => ps.map((p) => (p.plano === plano ? atualizado : p)));
        setFormularios((f) => ({ ...f, [plano]: doPlano(atualizado) }));
      }
      toast.success(`Plano ${NOMES[plano]} atualizado.`);
    } catch (err) {
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setSalvando(null);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-card/60 p-5">
      <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
        <Tag className="h-4 w-4 text-alerta" />
        Planos e Preços
      </h2>
      <p className="text-xs text-muted-suave mt-1 mb-4">
        O que aparece na página pública. Campo em branco fica como{" "}
        <strong className="text-muted-foreground">a definir</strong> na landing.
      </p>

      {carregando ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-alerta" />
        </div>
      ) : (
        <div className="space-y-4">
          {planos.map((plano) => {
            const form = formularios[plano.plano];
            if (!form) return null;
            return (
              <div
                key={plano.plano}
                className="rounded-lg border border-border bg-card shadow-elevacao p-4"
              >
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    {NOMES[plano.plano] ?? plano.plano}
                  </h3>
                  <button
                    onClick={() => salvar(plano.plano)}
                    disabled={salvando === plano.plano}
                    className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition-colors"
                  >
                    {salvando === plano.plano && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    Salvar
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className={labelCls} htmlFor={`mensal-${plano.plano}`}>
                      Preço mensal (R$)
                    </label>
                    <input
                      id={`mensal-${plano.plano}`}
                      value={form.preco_mensal}
                      onChange={(e) =>
                        editar(plano.plano, "preco_mensal", e.target.value)
                      }
                      inputMode="decimal"
                      placeholder="a definir"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor={`anual-${plano.plano}`}>
                      Preço anual (R$)
                    </label>
                    <input
                      id={`anual-${plano.plano}`}
                      value={form.preco_anual}
                      onChange={(e) =>
                        editar(plano.plano, "preco_anual", e.target.value)
                      }
                      inputMode="decimal"
                      placeholder="a definir"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls} htmlFor={`usuarios-${plano.plano}`}>
                      Limite de usuários
                    </label>
                    <input
                      id={`usuarios-${plano.plano}`}
                      value={form.limite_usuarios}
                      onChange={(e) =>
                        editar(plano.plano, "limite_usuarios", e.target.value)
                      }
                      inputMode="numeric"
                      placeholder="sem limite"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label
                      className={labelCls}
                      htmlFor={`armazenamento-${plano.plano}`}
                    >
                      Armazenamento (GB)
                    </label>
                    <input
                      id={`armazenamento-${plano.plano}`}
                      value={form.limite_armazenamento_gb}
                      onChange={(e) =>
                        editar(
                          plano.plano,
                          "limite_armazenamento_gb",
                          e.target.value
                        )
                      }
                      inputMode="numeric"
                      placeholder="sem limite"
                      className={inputCls}
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-4">
                    <label className={labelCls} htmlFor={`suporte-${plano.plano}`}>
                      Descrição do suporte
                    </label>
                    <input
                      id={`suporte-${plano.plano}`}
                      value={form.descricao_suporte}
                      onChange={(e) =>
                        editar(plano.plano, "descricao_suporte", e.target.value)
                      }
                      placeholder="Ex.: Suporte por WhatsApp em horário comercial"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
