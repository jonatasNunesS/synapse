"use client";
/**
 * Seção "Usuários" do detalhe da empresa. Lista todos os CustomUser da empresa
 * e permite: mudar o perfil, redefinir a senha (senha temporária exibida uma
 * vez) e desativar/reativar. Usuários is_staff_synapse aparecem com o badge
 * "Staff Synapse" e têm as ações bloqueadas — o painel nunca os altera.
 */
import { useState } from "react";
import { toast } from "sonner";
import {
  Users,
  ShieldCheck,
  KeyRound,
  UserX,
  UserCheck,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import {
  editarUsuario,
  redefinirSenhaUsuario,
} from "@/hooks/usePainelAdmin";
import { getErrorMessage } from "@/lib/api";
import { PERFIS, type UsuarioAdmin } from "@/types/painel_admin";

interface Props {
  empresaId: string;
  usuarios: UsuarioAdmin[];
  onMutate: () => void;
}

function formatData(iso: string | null): string {
  if (!iso) return "nunca";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function UsuariosSection({ empresaId, usuarios, onMutate }: Props) {
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);
  const [senhaGerada, setSenhaGerada] = useState<{ nome: string; senha: string } | null>(null);

  const mudarPerfil = async (u: UsuarioAdmin, perfil: string) => {
    setOcupadoId(u.id);
    try {
      await editarUsuario(empresaId, u.id, { perfil });
      toast.success(`Perfil de ${u.nome} atualizado.`);
      onMutate();
    } catch (err) {
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setOcupadoId(null);
    }
  };

  const alternarAtivo = async (u: UsuarioAdmin) => {
    setOcupadoId(u.id);
    try {
      await editarUsuario(empresaId, u.id, { is_active: !u.is_active });
      toast.success(u.is_active ? `${u.nome} desativado.` : `${u.nome} reativado.`);
      onMutate();
    } catch (err) {
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setOcupadoId(null);
    }
  };

  const redefinir = async (u: UsuarioAdmin) => {
    setOcupadoId(u.id);
    try {
      const senha = await redefinirSenhaUsuario(empresaId, u.id);
      setSenhaGerada({ nome: u.nome, senha });
    } catch (err) {
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setOcupadoId(null);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card/50 p-5">
      <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <Users className="h-4 w-4 text-alerta" />
        Usuários ({usuarios.length})
      </h2>

      <div className="space-y-2">
        {usuarios.length === 0 && (
          <p className="text-sm text-muted-suave">Sem usuários.</p>
        )}

        {usuarios.map((u) => {
          const ocupado = ocupadoId === u.id;
          const inativo = !u.is_active;
          return (
            <div
              key={u.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2.5 px-3 rounded-lg bg-secondary/40 border border-border"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-foreground font-medium truncate">{u.nome}</span>
                  {u.is_staff_synapse && (
                    <span className="inline-flex items-center gap-1 text-[0.625rem] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/20 text-alerta">
                      <ShieldCheck className="h-3 w-3" />
                      Staff Synapse
                    </span>
                  )}
                  {inativo && (
                    <span className="text-[0.625rem] font-medium px-1.5 py-0.5 rounded-full bg-slate-600/40 text-foreground-suave">
                      Inativo
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-suave truncate">
                  {u.email} · último acesso: {formatData(u.ultimo_acesso)}
                </p>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {u.is_staff_synapse ? (
                  <span className="text-xs text-muted-suave italic">ações bloqueadas</span>
                ) : (
                  <>
                    <select
                      value={u.perfil}
                      disabled={ocupado}
                      onChange={(e) => mudarPerfil(u, e.target.value)}
                      className="rounded-lg border border-border bg-secondary px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50"
                    >
                      {PERFIS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => redefinir(u)}
                      disabled={ocupado}
                      title="Redefinir senha"
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-alerta hover:bg-slate-700/50 transition-colors disabled:opacity-50"
                    >
                      {ocupado ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                    </button>

                    <button
                      onClick={() => alternarAtivo(u)}
                      disabled={ocupado}
                      title={u.is_active ? "Desativar usuário" : "Reativar usuário"}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-700/50 transition-colors disabled:opacity-50"
                    >
                      {u.is_active ? (
                        <UserX className="h-3.5 w-3.5" />
                      ) : (
                        <UserCheck className="h-3.5 w-3.5 text-sucesso" />
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {senhaGerada && (
        <SenhaTemporariaModal
          nome={senhaGerada.nome}
          senha={senhaGerada.senha}
          onClose={() => {
            setSenhaGerada(null);
            onMutate();
          }}
        />
      )}
    </div>
  );
}

function SenhaTemporariaModal({
  nome,
  senha,
  onClose,
}: {
  nome: string;
  senha: string;
  onClose: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(senha);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card shadow-xl">
        <div className="px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-alerta" />
            Senha temporária de {nome}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Copie e envie ao usuário agora — ela não será exibida novamente.
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2">
            <code className="flex-1 text-sm text-alerta font-mono break-all">{senha}</code>
            <button
              onClick={copiar}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-700/50 transition-colors"
              title="Copiar"
            >
              {copiado ? <Check className="h-4 w-4 text-sucesso" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-end px-5 py-3.5 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 text-sm font-medium hover:bg-amber-400 transition-colors"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
