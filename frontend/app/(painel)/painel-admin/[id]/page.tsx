"use client";
/**
 * Painel Administrativo — detalhe da empresa: dados, métricas de uso, status
 * (ativa/suspensa), edição, suspensão/reativação, exclusão definitiva (após 30
 * dias suspensa), seção de usuários e histórico de eventos.
 */
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
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
  Pencil,
  PauseCircle,
  PlayCircle,
  Trash2,
  FileText,
  UserRound,
  CalendarClock,
} from "lucide-react";
import { useEmpresaAdmin, useHistoricoPlano, reativarEmpresa } from "@/hooks/usePainelAdmin";
import { useAuth } from "@/hooks/useAuth";
import { TrocarPlanoModal } from "@/components/painel_admin/TrocarPlanoModal";
import { EditarEmpresaModal } from "@/components/painel_admin/EditarEmpresaModal";
import { SuspenderEmpresaModal } from "@/components/painel_admin/SuspenderEmpresaModal";
import { ExcluirEmpresaModal } from "@/components/painel_admin/ExcluirEmpresaModal";
import { UsuariosSection } from "@/components/painel_admin/UsuariosSection";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { getErrorMessage } from "@/lib/api";
import { podeExcluir } from "@/types/painel_admin";

const ACAO_LABEL: Record<string, string> = {
  troca_plano: "Troca de plano",
  criacao: "Empresa criada",
  suspenso: "Suspensa",
  reativado: "Reativada",
};

function Dado({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm text-slate-200 mt-0.5">{valor}</p>
    </div>
  );
}

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function PainelAdminEmpresaDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const empresaId = (params?.id as string) ?? null;
  const { empresa, isLoading, mutate } = useEmpresaAdmin(empresaId);
  const { historico, mutate: mutateHist } = useHistoricoPlano(empresaId);
  const { usuario } = useAuth();

  const [modalPlano, setModalPlano] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [modalSuspender, setModalSuspender] = useState(false);
  const [modalExcluir, setModalExcluir] = useState(false);
  const [confirmarReativar, setConfirmarReativar] = useState(false);
  const [reativando, setReativando] = useState(false);

  if (isLoading || !empresa) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
      </div>
    );
  }

  const suspensa = empresa.status === "suspensa";
  const excluivel = podeExcluir(empresa.status, empresa.data_suspensao);

  const recarregar = () => {
    mutate();
    mutateHist();
  };

  const reativar = async () => {
    if (reativando) return;
    setReativando(true);
    try {
      await reativarEmpresa(empresa.id);
      toast.success("Empresa reativada.");
      setConfirmarReativar(false);
      recarregar();
    } catch (err) {
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setReativando(false);
    }
  };

  return (
    <div className="space-y-5">
      <Link
        href="/painel-admin"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Empresas
      </Link>

      {/* Cabeçalho da empresa + ações */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-amber-400" />
              {empresa.nome}
            </h1>
            {suspensa ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/20 text-red-300">
                🔴 Suspensa
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                🟢 Ativa
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-0.5">
            Plano atual: <span className="text-slate-200 font-medium">{empresa.plano}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setModalEditar(true)} className={btnSecundario}>
            <Pencil className="h-4 w-4" />
            Editar
          </button>
          <button onClick={() => setModalPlano(true)} className={btnSecundario}>
            <RefreshCw className="h-4 w-4" />
            Trocar plano
          </button>
          {suspensa ? (
            <button
              onClick={() => setConfirmarReativar(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors"
            >
              <PlayCircle className="h-4 w-4" />
              Reativar
            </button>
          ) : (
            <button
              onClick={() => setModalSuspender(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-600/90 text-white text-sm font-medium hover:bg-red-500 transition-colors"
            >
              <PauseCircle className="h-4 w-4" />
              Suspender
            </button>
          )}
          {excluivel && (
            <button
              onClick={() => setModalExcluir(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/40 text-red-300 text-sm font-medium hover:bg-red-950/40 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Excluir definitivamente
            </button>
          )}
        </div>
      </div>

      {/* Aviso de suspensão */}
      {suspensa && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-4">
          <p className="text-sm text-red-200">
            <span className="font-semibold">Empresa suspensa.</span>{" "}
            {empresa.motivo_suspensao && <>Motivo: “{empresa.motivo_suspensao}”. </>}
            Suspensa em {fmtData(empresa.data_suspensao)}
            {empresa.suspensa_por_nome && <> por {empresa.suspensa_por_nome}</>}.
          </p>
          {!excluivel && (
            <p className="text-xs text-red-300/70 mt-1">
              A exclusão definitiva fica disponível 30 dias após a suspensão.
            </p>
          )}
        </div>
      )}

      {/* Dados + métricas */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Dado label="Segmento" valor={empresa.segmento} />
        <Dado label="CNPJ" valor={empresa.cnpj || "—"} />
        <Dado
          label="Usuários"
          valor={
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-slate-400" /> {empresa.total_usuarios}
            </span>
          }
        />
        <Dado
          label="Último acesso"
          valor={
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5 text-slate-400" />{" "}
              {empresa.ultimo_acesso ? fmtData(empresa.ultimo_acesso) : "nunca"}
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
        <Dado
          label="Créditos no mês"
          valor={
            <span className="inline-flex items-center gap-1">
              <Coins className="h-3.5 w-3.5 text-slate-400" /> {empresa.creditos_usados_mes}
            </span>
          }
        />
        <Dado
          label="Lançamentos"
          valor={
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3.5 w-3.5 text-slate-400" /> {empresa.total_lancamentos}
            </span>
          }
        />
        <Dado
          label="Clientes"
          valor={
            <span className="inline-flex items-center gap-1">
              <UserRound className="h-3.5 w-3.5 text-slate-400" /> {empresa.total_clientes}
            </span>
          }
        />
      </div>

      {/* Usuários */}
      <UsuariosSection
        empresaId={empresa.id}
        usuarios={empresa.usuarios}
        onMutate={recarregar}
      />

      {/* Histórico de eventos */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-amber-400" />
          Histórico
        </h2>
        {historico.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum evento registrado.</p>
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
                    <span className="text-slate-400">{ACAO_LABEL[log.acao] ?? "Evento"}:</span>{" "}
                    {log.acao === "troca_plano"
                      ? `${log.plano_anterior} → ${log.plano_novo}`
                      : log.plano_novo}
                    {log.status === "erro" && <span className="text-red-400"> (falhou)</span>}
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

      {modalPlano && (
        <TrocarPlanoModal
          empresaId={empresa.id}
          empresaNome={empresa.nome}
          planoAtual={empresa.plano}
          onClose={() => setModalPlano(false)}
          onSuccess={recarregar}
        />
      )}
      {modalEditar && (
        <EditarEmpresaModal
          empresaId={empresa.id}
          nomeAtual={empresa.nome}
          segmentoAtual={empresa.segmento}
          onClose={() => setModalEditar(false)}
          onSuccess={recarregar}
        />
      )}
      {modalSuspender && (
        <SuspenderEmpresaModal
          empresaId={empresa.id}
          empresaNome={empresa.nome}
          onClose={() => setModalSuspender(false)}
          onSuccess={recarregar}
        />
      )}
      {modalExcluir && (
        <ExcluirEmpresaModal
          empresaId={empresa.id}
          empresaNome={empresa.nome}
          staffEmail={usuario?.email ?? ""}
          onClose={() => setModalExcluir(false)}
          onExcluida={() => {
            setModalExcluir(false);
            router.push("/painel-admin");
          }}
        />
      )}
      <ConfirmDialog
        open={confirmarReativar}
        danger={false}
        titulo="Reativar empresa?"
        mensagem={
          <>
            A empresa <span className="text-white font-medium">{empresa.nome}</span> volta a ter
            acesso normal ao sistema.
          </>
        }
        confirmLabel="Reativar"
        cancelLabel="Cancelar"
        processando={reativando}
        onConfirm={reativar}
        onCancel={() => setConfirmarReativar(false)}
      />
    </div>
  );
}

const btnSecundario =
  "inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-700 transition-colors";
