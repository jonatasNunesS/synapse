"use client";
/**
 * Exclusão definitiva (hard delete). Tripla proteção:
 *  1. Aviso de que apaga TODOS os dados da empresa.
 *  2. Digitar o nome exato da empresa.
 *  3. Digitar a própria senha de staff — verificada re-autenticando no backend
 *     antes de excluir (o botão só habilita com nome correto + senha preenchida).
 * O backend ainda valida a trava de 30 dias suspensa; erros são exibidos.
 */
import { useState } from "react";
import { toast } from "sonner";
import { X, Loader2, AlertTriangle } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";
import { excluirEmpresa } from "@/hooks/usePainelAdmin";

interface Props {
  empresaId: string;
  empresaNome: string;
  staffEmail: string;
  onClose: () => void;
  /** Chamado após excluir com sucesso (ex.: redirecionar para a lista). */
  onExcluida: () => void;
}

export function ExcluirEmpresaModal({
  empresaId,
  empresaNome,
  staffEmail,
  onClose,
  onExcluida,
}: Props) {
  const [nomeConfirma, setNomeConfirma] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);

  const nomeConfere = nomeConfirma.trim() === empresaNome.trim();
  const habilitado = nomeConfere && senha.length > 0 && !enviando;

  const excluir = async () => {
    if (!habilitado) return;
    setEnviando(true);
    try {
      // 3ª proteção: confirma a senha de staff re-autenticando no backend.
      try {
        await api.post("/auth/login/", { email: staffEmail, senha });
      } catch {
        toast.error("Senha de staff incorreta.", { duration: 6000 });
        setEnviando(false);
        return;
      }
      await excluirEmpresa(empresaId);
      toast.success(`Empresa ${empresaNome} excluída definitivamente.`);
      onExcluida();
    } catch (err) {
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-red-500/40 bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-red-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Excluir definitivamente
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-lg border border-red-500/30 bg-red-950/30 p-3">
            <p className="text-sm text-red-200">
              Isso apagará <span className="font-semibold">TODOS os dados</span> desta empresa
              (lançamentos, clientes, produtos, projetos, usuários…). Esta ação{" "}
              <span className="font-semibold">não pode ser desfeita</span>.
            </p>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Digite o nome exato da empresa:{" "}
              <span className="font-semibold text-slate-200">{empresaNome}</span>
            </label>
            <input
              value={nomeConfirma}
              onChange={(e) => setNomeConfirma(e.target.value)}
              placeholder="Nome da empresa"
              className={inputCls}
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">
              Digite sua senha de staff para confirmar:
            </label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Sua senha"
              className={inputCls}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={excluir}
            disabled={!habilitado}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
            Excluir definitivamente
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-red-500";
