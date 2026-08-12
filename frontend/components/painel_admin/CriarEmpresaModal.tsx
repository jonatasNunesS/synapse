"use client";
/**
 * Modal de criação de empresa + admin inicial. Senha com toggle mostrar/esconder.
 * Erros de validação do backend (email duplicado, senha fraca, segmento) são
 * exibidos por campo.
 */
import { useState } from "react";
import { toast } from "sonner";
import { X, Loader2, Eye, EyeOff, Building2 } from "lucide-react";
import { criarEmpresa } from "@/hooks/usePainelAdmin";
import { getErrorMessage, getFieldErrors } from "@/lib/api";
import { PLANOS, SEGMENTOS, type CriarEmpresaPayload, type Plano } from "@/types/painel_admin";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const VAZIO: CriarEmpresaPayload = {
  nome_empresa: "",
  segmento: "eventos",
  plano: "starter",
  admin_nome: "",
  admin_email: "",
  admin_senha: "",
};

export function CriarEmpresaModal({ onClose, onSuccess }: Props) {
  const [form, setForm] = useState<CriarEmpresaPayload>(VAZIO);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<Record<string, string[]>>({});

  const set = (campo: keyof CriarEmpresaPayload, valor: string) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const completo =
    form.nome_empresa.trim() &&
    form.admin_nome.trim() &&
    form.admin_email.trim() &&
    form.admin_senha;

  const criar = async () => {
    if (!completo || enviando) return;
    setEnviando(true);
    setErros({});
    try {
      const empresa = await criarEmpresa({
        ...form,
        nome_empresa: form.nome_empresa.trim(),
        admin_nome: form.admin_nome.trim(),
        admin_email: form.admin_email.trim(),
      });
      toast.success(`Empresa ${empresa.nome} criada com sucesso.`);
      onSuccess();
      onClose();
    } catch (err) {
      const campos = getFieldErrors(err);
      if (campos) setErros(campos);
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setEnviando(false);
    }
  };

  const erroDe = (campo: string) => erros[campo]?.[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Building2 className="h-4 w-4 text-amber-400" />
            Criar empresa
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <Campo label="Nome da empresa" erro={erroDe("nome_empresa")}>
            <input
              value={form.nome_empresa}
              onChange={(e) => set("nome_empresa", e.target.value)}
              placeholder="Impactar Cerimonial"
              className={inputCls}
            />
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Segmento" erro={erroDe("segmento")}>
              <select
                value={form.segmento}
                onChange={(e) => set("segmento", e.target.value)}
                className={inputCls}
              >
                {SEGMENTOS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Plano" erro={erroDe("plano")}>
              <select
                value={form.plano}
                onChange={(e) => set("plano", e.target.value as Plano)}
                className={inputCls}
              >
                {PLANOS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <div className="pt-2 border-t border-slate-800">
            <p className="text-[0.6875rem] uppercase tracking-wide text-slate-500 mb-3">
              Administrador da empresa
            </p>
            <div className="space-y-4">
              <Campo label="Nome do admin" erro={erroDe("admin_nome")}>
                <input
                  value={form.admin_nome}
                  onChange={(e) => set("admin_nome", e.target.value)}
                  placeholder="Patrícia"
                  className={inputCls}
                />
              </Campo>
              <Campo label="E-mail do admin" erro={erroDe("admin_email")}>
                <input
                  type="email"
                  value={form.admin_email}
                  onChange={(e) => set("admin_email", e.target.value)}
                  placeholder="patricia@impactar.com"
                  className={inputCls}
                />
              </Campo>
              <Campo label="Senha temporária" erro={erroDe("admin_senha")}>
                <div className="relative">
                  <input
                    type={mostrarSenha ? "text" : "password"}
                    value={form.admin_senha}
                    onChange={(e) => set("admin_senha", e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className={`${inputCls} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    aria-label={mostrarSenha ? "Esconder senha" : "Mostrar senha"}
                  >
                    {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Campo>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-800 bg-slate-900">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={criar}
            disabled={!completo || enviando}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-slate-950 text-sm font-medium hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar empresa
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500";

function Campo({
  label,
  erro,
  children,
}: {
  label: string;
  erro?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs text-slate-400 block mb-1">{label}</label>
      {children}
      {erro && <p className="text-xs text-red-400 mt-1">{erro}</p>}
    </div>
  );
}
