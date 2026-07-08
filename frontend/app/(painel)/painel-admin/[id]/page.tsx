"use client";
/**
 * Painel Administrativo — detalhe da empresa: dados, usuários, histórico de
 * planos e botão de troca de plano (modal com confirmação por nome).
 */
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Users,
  Coins,
  History,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  useEmpresaAdmin,
  useHistoricoPlano,
} from "@/hooks/usePainelAdmin";
import { TrocarPlanoModal } from "@/components/painel_admin/TrocarPlanoModal";

function Dado({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm text-slate-200 mt-0.5">{valor}</p>
    </div>
  );
}

export default function PainelAdminEmpresaDetalhePage() {
  const params = useParams();
  const empresaId = (params?.id as string) ?? null;
  const { empresa, isLoading, mutate } = useEmpresaAdmin(empresaId);
  const { historico, mutate: mutateHist } = useHistoricoPlano(empresaId);
  const [modalAberto, setModalAberto] = useState(false);

  if (isLoading || !empresa) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href="/painel-admin"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Empresas
      </Link>

      {/* Cabeçalho da empresa */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="h-5 w-5 text-amber-400" />
            {empresa.nome}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Plano atual: <span className="text-slate-200 font-medium">{empresa.plano}</span>
            {!empresa.plano_ativo && <span className="text-red-400"> · inativo</span>}
          </p>
        </div>
        <button
          onClick={() => setModalAberto(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-slate-950 text-sm font-medium hover:bg-amber-400 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Trocar plano
        </button>
      </div>

      {/* Dados + contadores */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Dado label="Segmento" valor={empresa.segmento} />
        <Dado label="CNPJ" valor={empresa.cnpj || "—"} />
        <Dado
          label="Usuários"
          valor={
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-slate-400" /> {empresa.num_usuarios}
            </span>
          }
        />
        <Dado
          label="Créditos hoje"
          valor={
            <span className="inline-flex items-center gap-1">
              <Coins className="h-3.5 w-3.5 text-slate-400" /> {empresa.creditos_usados_hoje}
            </span>
          }
        />
      </div>

      {/* Usuários */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-amber-400" />
          Usuários ({empresa.usuarios.length})
        </h2>
        <div className="space-y-1.5">
          {empresa.usuarios.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between text-sm py-1.5 border-b border-slate-800/60 last:border-0"
            >
              <div>
                <span className="text-slate-200">{u.nome}</span>
                <span className="text-slate-500"> · {u.email}</span>
              </div>
              <span className="text-xs text-slate-500">
                {u.perfil}
                {u.is_staff_synapse && (
                  <span className="ml-1.5 text-amber-400">staff</span>
                )}
              </span>
            </div>
          ))}
          {empresa.usuarios.length === 0 && (
            <p className="text-sm text-slate-500">Sem usuários.</p>
          )}
        </div>
      </div>

      {/* Histórico de planos */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-amber-400" />
          Histórico de planos
        </h2>
        {historico.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma troca de plano registrada.</p>
        ) : (
          <ul className="space-y-2">
            {historico.map((log) => (
              <li
                key={log.id}
                className="flex items-start gap-2.5 text-sm border-b border-slate-800/60 last:border-0 pb-2 last:pb-0"
              >
                {log.status === "sucesso" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="text-slate-200">
                    {log.plano_anterior} → {log.plano_novo}
                    {log.status === "erro" && (
                      <span className="text-red-400"> (falhou)</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(log.alterado_em).toLocaleString("pt-BR")}
                    {log.alterado_por_nome && ` · ${log.alterado_por_nome}`}
                  </p>
                  {log.observacao && (
                    <p className="text-xs text-slate-400 mt-0.5">“{log.observacao}”</p>
                  )}
                  {log.status === "erro" && log.erro && (
                    <p className="text-xs text-red-400/80 mt-0.5">{log.erro}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modalAberto && (
        <TrocarPlanoModal
          empresaId={empresa.id}
          empresaNome={empresa.nome}
          planoAtual={empresa.plano}
          onClose={() => setModalAberto(false)}
          onSuccess={() => {
            mutate();
            mutateHist();
          }}
        />
      )}
    </div>
  );
}
