"use client";
/**
 * Seção "Módulos" das Configurações.
 *
 * Lista os módulos OPCIONAIS com toggle. Os OBRIGATÓRIOS aparecem com o toggle
 * desabilitado e a explicação de que são essenciais. Desligar um módulo que já
 * tem dados pede confirmação — e deixa claro que NADA é apagado.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Blocks, Loader2, Lock } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";
import type { ModuloOpcional, ModulosEmpresa, Usuario } from "@/types/auth";
import { MODULOS_OPCIONAIS } from "@/types/auth";

interface ModuloInfo {
  label: string;
  descricao: string;
  icone: string;
}

interface ConfigModulos {
  modulos: ModulosEmpresa;
  obrigatorios: string[];
  info: Record<string, ModuloInfo>;
  contagens: Record<string, number>;
}

/** Rótulos dos módulos essenciais (não vêm do backend por não terem campo). */
const OBRIGATORIOS_INFO: Record<string, ModuloInfo> = {
  financeiro: { label: "Financeiro", descricao: "Lançamentos, caixa e DRE", icone: "💰" },
  clientes: { label: "Clientes / CRM", descricao: "Clientes, funil e interações", icone: "🤝" },
  dashboard: { label: "Dashboard", descricao: "Visão geral do negócio", icone: "📊" },
};

function Toggle({
  ativo,
  onClick,
  disabled,
  label,
}: {
  ativo: boolean;
  onClick?: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ativo}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
        ativo ? "bg-indigo-600" : "bg-slate-700"
      } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          ativo ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export function ModulosSection() {
  const usuario = useAppStore((s) => s.usuario);
  const setUsuario = useAppStore((s) => s.setUsuario);
  const isAdmin = usuario?.perfil === "admin";

  const [config, setConfig] = useState<ConfigModulos | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<ModuloOpcional | null>(null);
  const [confirmar, setConfirmar] = useState<ModuloOpcional | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const resp = await api.get<ConfigModulos>("/auth/empresa/modulos/");
      if (resp.success && resp.data) setConfig(resp.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /** Aplica a mudança e atualiza o store — a sidebar reage na hora. */
  const aplicar = async (modulo: ModuloOpcional, ativo: boolean) => {
    setSalvando(modulo);
    try {
      const resp = await api.patch<{ modulos: ModulosEmpresa }>(
        "/auth/empresa/modulos/",
        { [`modulo_${modulo}`]: ativo }
      );
      const novos = (resp.data as { modulos: ModulosEmpresa })?.modulos;
      if (novos) {
        setConfig((c) => (c ? { ...c, modulos: novos } : c));
        // Sem recarregar a página: o store alimenta o useModulos (sidebar etc.).
        if (usuario) setUsuario({ ...usuario, modulos: novos } as Usuario);
      }
      const label = config?.info[modulo]?.label ?? modulo;
      toast.success(ativo ? `Módulo ${label} ativado` : `Módulo ${label} desativado`);
    } catch (err) {
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setSalvando(null);
      setConfirmar(null);
    }
  };

  const alternar = (modulo: ModuloOpcional) => {
    if (!config || !isAdmin) return;
    const ativo = config.modulos[modulo];
    // Ligar é imediato. Desligar com dados pede confirmação.
    if (!ativo) return aplicar(modulo, true);
    if ((config.contagens[modulo] ?? 0) > 0) return setConfirmar(modulo);
    return aplicar(modulo, false);
  };

  const moduloConfirmando = confirmar ? config?.info[confirmar] : null;
  const qtdConfirmando = confirmar ? config?.contagens[confirmar] ?? 0 : 0;

  return (
    <section className="bg-[#0d1117] border border-white/10 rounded-xl p-6">
      <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
        <Blocks className="w-4 h-4 text-indigo-400" />
        Módulos
      </h2>
      <p className="text-xs text-slate-500 mb-5">
        Escolha o que sua empresa usa. Desativar apenas oculta o módulo —{" "}
        <strong className="text-slate-400">nenhum dado é apagado</strong>.
      </p>

      {!isAdmin && (
        <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
          Apenas administradores podem ativar ou desativar módulos.
        </div>
      )}

      {carregando ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
        </div>
      ) : (
        <div className="space-y-2">
          {/* Opcionais */}
          {MODULOS_OPCIONAIS.map((modulo) => {
            const info = config?.info[modulo];
            const ativo = config?.modulos[modulo] ?? true;
            const qtd = config?.contagens[modulo] ?? 0;
            return (
              <div
                key={modulo}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-white/5 bg-white/3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="text-lg leading-none mt-0.5">{info?.icone ?? "🔹"}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{info?.label ?? modulo}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{info?.descricao}</p>
                    {qtd > 0 && (
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        {qtd} {qtd === 1 ? "registro" : "registros"}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={`text-xs font-medium ${
                      ativo ? "text-emerald-400" : "text-slate-500"
                    }`}
                  >
                    {ativo ? "Ativo" : "Inativo"}
                  </span>
                  {salvando === modulo ? (
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  ) : (
                    <Toggle
                      ativo={ativo}
                      disabled={!isAdmin}
                      label={`${info?.label ?? modulo}`}
                      onClick={() => alternar(modulo)}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {/* Obrigatórios — toggle travado */}
          <p className="text-[11px] uppercase tracking-wide text-slate-600 pt-3 pb-1">
            Essenciais
          </p>
          {(config?.obrigatorios ?? Object.keys(OBRIGATORIOS_INFO)).map((modulo) => {
            const info = OBRIGATORIOS_INFO[modulo] ?? {
              label: modulo,
              descricao: "",
              icone: "🔹",
            };
            return (
              <div
                key={modulo}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-white/5 bg-white/3 opacity-80"
                title="Módulo essencial, não pode ser desativado"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="text-lg leading-none mt-0.5">{info.icone}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white flex items-center gap-1.5">
                      {info.label}
                      <Lock className="w-3 h-3 text-slate-500" />
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{info.descricao}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-medium text-emerald-400">Ativo</span>
                  <Toggle ativo disabled label={`${info.label} (essencial)`} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmação ao desativar módulo com dados */}
      {confirmar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-slate-900 shadow-xl">
            <div className="p-5">
              <h3 className="text-sm font-semibold text-white">
                Desativar {moduloConfirmando?.label}?
              </h3>
              <p className="text-sm text-slate-400 mt-2">
                Você tem{" "}
                <strong className="text-white">
                  {qtdConfirmando} {qtdConfirmando === 1 ? "registro" : "registros"}
                </strong>{" "}
                em {moduloConfirmando?.label}. Desativar o módulo vai ocultá-lo do
                sistema, mas <strong className="text-white">nenhum dado será apagado</strong>.
                Você pode reativar quando quiser e tudo estará como antes.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-white/10">
              <button
                onClick={() => setConfirmar(null)}
                className="px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/5"
              >
                Cancelar
              </button>
              <button
                onClick={() => aplicar(confirmar, false)}
                disabled={salvando === confirmar}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 disabled:opacity-50"
              >
                {salvando === confirmar && <Loader2 className="w-4 h-4 animate-spin" />}
                Desativar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
