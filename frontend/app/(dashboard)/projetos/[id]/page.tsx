"use client";
/**
 * Synapse — M6: Página de Detalhe do Projeto com Kanban
 * Rota: /projetos/[id]
 */
import { useState } from "react";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  LayoutGrid,
  List,
  Pencil,
  Trash2,
  Calendar,
  Users,
  AlertCircle,
} from "lucide-react";
import { KanbanBoard } from "@/components/projetos/KanbanBoard";
import { TarefaForm } from "@/components/projetos/TarefaForm";
import { TarefaModal } from "@/components/projetos/TarefaModal";
import { ProjetoForm } from "@/components/projetos/ProjetoForm";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  useProjetoDetalhe,
  useKanban,
  useTarefas,
  useTarefaDetalhe,
} from "@/hooks/useProjetos";
import type {
  ProjetoCreatePayload,
  TarefaCreatePayload,
  TarefaDetail,
  TarefaList,
  TarefaStatus,
} from "@/types/projetos";
import {
  PRIORIDADE_COLORS,
  PRIORIDADE_LABELS,
  PROJETO_STATUS_COLORS,
  PROJETO_STATUS_LABELS,
} from "@/types/projetos";
import { api, getErrorMessage } from "@/lib/api";
import type { ApiError } from "@/types/api";

export default function ProjetoDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const projetoId = params.id as string;

  const [visao, setVisao] = useState<"kanban" | "lista">("kanban");
  const [modalProjetoAberto, setModalProjetoAberto] = useState(false);
  const [modalTarefaAberto, setModalTarefaAberto] = useState(false);
  const [statusNovaTarefa, setStatusNovaTarefa] = useState<TarefaStatus>("a_fazer");
  const [tarefaDetalheId, setTarefaDetalheId] = useState<string | null>(null);
  const [tarefaEditando, setTarefaEditando] = useState<TarefaDetail | null>(null);
  const [deletando, setDeletando] = useState(false);
  const [confirmarExclusaoProjeto, setConfirmarExclusaoProjeto] = useState(false);
  const [tarefaParaExcluir, setTarefaParaExcluir] = useState<TarefaList | null>(null);
  const [excluindoTarefa, setExcluindoTarefa] = useState(false);

  const { projeto, loading: loadingProjeto, recarregar: recarregarProjeto } =
    useProjetoDetalhe(projetoId);
  const { kanban, loading: loadingKanban, recarregar: recarregarKanban, moverTarefa } =
    useKanban(projetoId);
  const { tarefas, loading: loadingTarefas, criar, atualizar, deletar: deletarTarefa } =
    useTarefas(projetoId);
  const { tarefa: tarefaDetalhe, recarregar: recarregarTarefa } =
    useTarefaDetalhe(tarefaDetalheId);

  const handleNovaTarefa = (status: TarefaStatus) => {
    setStatusNovaTarefa(status);
    setTarefaEditando(null);
    setModalTarefaAberto(true);
  };

  const handleAbrirTarefa = (tarefa: TarefaList) => {
    setTarefaDetalheId(tarefa.id);
  };

  const handleSalvarTarefa = async (dados: TarefaCreatePayload) => {
    if (tarefaEditando) {
      await atualizar(tarefaEditando.id, dados);
    } else {
      await criar(dados);
    }
    await recarregarKanban();
    setModalTarefaAberto(false);
    setTarefaEditando(null);
  };

  const handleMoverTarefa = async (
    tarefaId: string,
    novoStatus: TarefaStatus,
    ordem: number
  ) => {
    await moverTarefa(tarefaId, { status: novoStatus, ordem });
  };

  const handleSalvarProjeto = async (dados: ProjetoCreatePayload) => {
    await api.patch(`/projetos/${projetoId}/`, dados);
    await recarregarProjeto();
    setModalProjetoAberto(false);
  };

  const handleConfirmarExclusaoProjeto = async () => {
    if (deletando) return; // evita duplo clique
    setDeletando(true);
    try {
      await api.delete(`/projetos/${projetoId}/`);
      toast.success("Projeto excluído.");
      router.push("/projetos");
    } catch (err: unknown) {
      const e = err as ApiError;
      toast.error(e?.error?.message ?? "Não foi possível excluir o projeto.");
      setDeletando(false);
    }
  };

  const handleConfirmarExclusaoTarefa = async () => {
    if (!tarefaParaExcluir || excluindoTarefa) return; // evita duplo clique
    setExcluindoTarefa(true);
    try {
      await deletarTarefa(tarefaParaExcluir.id);
      toast.success("Tarefa excluída.");
      setTarefaParaExcluir(null);
      await recarregarKanban();
    } catch (err) {
      // Erro NUNCA calado: mostra a mensagem real do backend
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setExcluindoTarefa(false);
    }
  };

  if (loadingProjeto) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="h-8 bg-muted rounded animate-pulse w-48 mb-6" />
        <div className="h-24 bg-muted rounded-xl animate-pulse mb-4" />
        <div className="flex gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex-1 h-64 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!projeto) {
    return (
      <div className="p-6 max-w-7xl mx-auto text-center py-20">
        <p className="text-muted-suave">Projeto não encontrado.</p>
        <Link href="/projetos" className="text-brand-accent hover:underline mt-2 block">
          Voltar para Projetos
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-suave">
        <Link href="/projetos" className="hover:text-brand-accent flex items-center gap-1">
          <ArrowLeft size={14} />
          Projetos
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{projeto.nome}</span>
      </div>

      {/* Header do Projeto */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="w-4 h-4 rounded-full mt-1 flex-shrink-0"
              style={{ backgroundColor: projeto.cor || "#6366f1" }}
            />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground">{projeto.nome}</h1>
              {projeto.descricao && (
                <p className="text-sm text-muted-suave mt-0.5 line-clamp-2">{projeto.descricao}</p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    PROJETO_STATUS_COLORS[projeto.status]
                  }`}
                >
                  {PROJETO_STATUS_LABELS[projeto.status]}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    PRIORIDADE_COLORS[projeto.prioridade]
                  }`}
                >
                  {PRIORIDADE_LABELS[projeto.prioridade]}
                </span>
                {projeto.esta_atrasado && (
                  <span className="flex items-center gap-1 text-xs text-erro font-medium">
                    <AlertCircle size={12} />
                    Atrasado
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setModalProjetoAberto(true)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground border border-border px-3 py-1.5 rounded-lg hover:bg-superficie transition-colors"
            >
              <Pencil size={14} />
              Editar
            </button>
            <button
              onClick={() => setConfirmarExclusaoProjeto(true)}
              disabled={deletando}
              className="flex items-center gap-1.5 text-sm text-erro border border-erro/30 px-3 py-1.5 rounded-lg hover:bg-erro/10 transition-colors disabled:opacity-50"
            >
              <Trash2 size={14} />
              Excluir
            </button>
          </div>
        </div>

        {/* Métricas */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-100 text-sm text-muted-foreground flex-wrap">
          <div>
            <span className="text-xs text-muted-foreground block">Progresso</span>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-24 bg-muted rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: `${projeto.progresso}%`,
                    backgroundColor: projeto.cor || "#6366f1",
                  }}
                />
              </div>
              <span className="font-medium">{projeto.progresso}%</span>
            </div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Tarefas</span>
            <span className="font-medium">
              {projeto.tarefas_concluidas}/{projeto.total_tarefas}
            </span>
          </div>
          {projeto.responsavel_nome && (
            <div className="flex items-center gap-1.5">
              <Users size={14} className="text-muted-foreground" />
              <span>{projeto.responsavel_nome}</span>
            </div>
          )}
          {projeto.data_prazo && (
            <div className="flex items-center gap-1.5">
              <Calendar size={14} className="text-muted-foreground" />
              <span className={projeto.esta_atrasado ? "text-erro font-medium" : ""}>
                {new Date(projeto.data_prazo).toLocaleDateString("pt-BR")}
              </span>
            </div>
          )}
          {projeto.membros && projeto.membros.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground block">Membros</span>
              <div className="flex -space-x-1 mt-0.5">
                {projeto.membros.slice(0, 5).map((m) => (
                  <div
                    key={m.id}
                    className="w-6 h-6 rounded-full bg-brand-500/15 border-2 border-white flex items-center justify-center text-brand-accent text-xs font-bold"
                    title={m.nome}
                  >
                    {m.nome.charAt(0).toUpperCase()}
                  </div>
                ))}
                {projeto.membros.length > 5 && (
                  <div className="w-6 h-6 rounded-full bg-muted border-2 border-white flex items-center justify-center text-muted-foreground text-xs">
                    +{projeto.membros.length - 5}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controles de visão */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setVisao("kanban")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              visao === "kanban"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-suave hover:text-foreground-suave"
            }`}
          >
            <LayoutGrid size={14} />
            Kanban
          </button>
          <button
            onClick={() => setVisao("lista")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              visao === "lista"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-suave hover:text-foreground-suave"
            }`}
          >
            <List size={14} />
            Lista
          </button>
        </div>
        <button
          onClick={() => handleNovaTarefa("a_fazer")}
          className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
        >
          + Nova Tarefa
        </button>
      </div>

      {/* Kanban */}
      {visao === "kanban" && (
        <>
          {loadingKanban ? (
            <div className="flex gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex-shrink-0 w-72 h-64 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : kanban ? (
            <KanbanBoard
              kanban={kanban}
              onMoverTarefa={handleMoverTarefa}
              onAbrirTarefa={handleAbrirTarefa}
              onNovaTarefa={handleNovaTarefa}
            />
          ) : null}
        </>
      )}

      {/* Lista */}
      {visao === "lista" && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {loadingTarefas ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : tarefas.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <p>Nenhuma tarefa neste projeto.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-superficie border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tarefa</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Prioridade</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Responsável</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Prazo</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tarefas.map((tarefa) => (
                  <tr
                    key={tarefa.id}
                    className="hover:bg-superficie cursor-pointer transition-colors"
                    onClick={() => handleAbrirTarefa(tarefa)}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {tarefa.titulo}
                      {tarefa.esta_atrasada && (
                        <AlertCircle size={12} className="inline ml-1 text-erro" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          PROJETO_STATUS_COLORS[tarefa.status as keyof typeof PROJETO_STATUS_COLORS] ?? ""
                        }`}
                      >
                        {tarefa.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          PRIORIDADE_COLORS[tarefa.prioridade]
                        }`}
                      >
                        {PRIORIDADE_LABELS[tarefa.prioridade]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {tarefa.responsavel_nome ?? "—"}
                    </td>
                    <td
                      className={`px-4 py-3 ${
                        tarefa.esta_atrasada ? "text-erro font-medium" : "text-muted-foreground"
                      }`}
                    >
                      {tarefa.data_prazo
                        ? new Date(tarefa.data_prazo).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTarefaParaExcluir(tarefa);
                        }}
                        className="text-foreground-suave hover:text-erro transition-colors"
                        title="Excluir tarefa"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal de Detalhe da Tarefa */}
      {tarefaDetalheId && tarefaDetalhe && (
        <TarefaModal
          tarefa={tarefaDetalhe}
          onFechar={() => setTarefaDetalheId(null)}
          onEditar={() => {
            setTarefaEditando(tarefaDetalhe);
            setModalTarefaAberto(true);
            setTarefaDetalheId(null);
          }}
          onRecarregar={() => {
            recarregarTarefa();
            recarregarKanban();
          }}
        />
      )}

      {/* Modal de Criação/Edição de Tarefa */}
      <TarefaForm
        aberto={modalTarefaAberto}
        tarefa={tarefaEditando}
        statusInicial={statusNovaTarefa}
        onFechar={() => {
          setModalTarefaAberto(false);
          setTarefaEditando(null);
        }}
        onSalvar={handleSalvarTarefa}
      />

      {/* Modal de Edição do Projeto */}
      <ProjetoForm
        aberto={modalProjetoAberto}
        projeto={projeto}
        onFechar={() => setModalProjetoAberto(false)}
        onSalvar={handleSalvarProjeto}
      />

      {/* Confirmação — excluir projeto */}
      <ConfirmDialog
        open={confirmarExclusaoProjeto}
        titulo="Excluir projeto"
        mensagem={
          <>
            Excluir o projeto{" "}
            <span className="text-foreground font-medium">{projeto.nome}</span>? Todas
            as tarefas vinculadas serão removidas. Esta ação não pode ser desfeita.
          </>
        }
        confirmLabel="Excluir"
        processando={deletando}
        onConfirm={handleConfirmarExclusaoProjeto}
        onCancel={() => setConfirmarExclusaoProjeto(false)}
      />

      {/* Confirmação — excluir tarefa */}
      <ConfirmDialog
        open={!!tarefaParaExcluir}
        titulo="Excluir tarefa"
        mensagem={
          <>
            Excluir a tarefa{" "}
            <span className="text-foreground font-medium">
              {tarefaParaExcluir?.titulo}
            </span>
            ? Esta ação não pode ser desfeita.
          </>
        }
        confirmLabel="Excluir"
        processando={excluindoTarefa}
        onConfirm={handleConfirmarExclusaoTarefa}
        onCancel={() => setTarefaParaExcluir(null)}
      />
    </div>
  );
}
