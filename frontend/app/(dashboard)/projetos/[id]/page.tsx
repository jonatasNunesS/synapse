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
import { api } from "@/lib/api";
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

  const handleDeletarProjeto = async () => {
    if (!confirm("Tem certeza que deseja excluir este projeto?")) return;
    setDeletando(true);
    try {
      await api.delete(`/projetos/${projetoId}/`);
      router.push("/projetos");
    } catch (err: unknown) {
      const e = err as ApiError;
      toast.error(e?.error?.message ?? "Não foi possível excluir o projeto.");
      setDeletando(false);
    }
  };

  if (loadingProjeto) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="h-8 bg-gray-100 rounded animate-pulse w-48 mb-6" />
        <div className="h-24 bg-gray-100 rounded-xl animate-pulse mb-4" />
        <div className="flex gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex-1 h-64 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!projeto) {
    return (
      <div className="p-6 max-w-7xl mx-auto text-center py-20">
        <p className="text-gray-500">Projeto não encontrado.</p>
        <Link href="/projetos" className="text-indigo-600 hover:underline mt-2 block">
          Voltar para Projetos
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/projetos" className="hover:text-indigo-600 flex items-center gap-1">
          <ArrowLeft size={14} />
          Projetos
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{projeto.nome}</span>
      </div>

      {/* Header do Projeto */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="w-4 h-4 rounded-full mt-1 flex-shrink-0"
              style={{ backgroundColor: projeto.cor || "#6366f1" }}
            />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900">{projeto.nome}</h1>
              {projeto.descricao && (
                <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{projeto.descricao}</p>
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
                  <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
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
              className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Pencil size={14} />
              Editar
            </button>
            <button
              onClick={handleDeletarProjeto}
              disabled={deletando}
              className="flex items-center gap-1.5 text-sm text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <Trash2 size={14} />
              Excluir
            </button>
          </div>
        </div>

        {/* Métricas */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-100 text-sm text-gray-600 flex-wrap">
          <div>
            <span className="text-xs text-gray-400 block">Progresso</span>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-24 bg-gray-100 rounded-full h-1.5">
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
            <span className="text-xs text-gray-400 block">Tarefas</span>
            <span className="font-medium">
              {projeto.tarefas_concluidas}/{projeto.total_tarefas}
            </span>
          </div>
          {projeto.responsavel_nome && (
            <div className="flex items-center gap-1.5">
              <Users size={14} className="text-gray-400" />
              <span>{projeto.responsavel_nome}</span>
            </div>
          )}
          {projeto.data_prazo && (
            <div className="flex items-center gap-1.5">
              <Calendar size={14} className="text-gray-400" />
              <span className={projeto.esta_atrasado ? "text-red-600 font-medium" : ""}>
                {new Date(projeto.data_prazo).toLocaleDateString("pt-BR")}
              </span>
            </div>
          )}
          {projeto.membros && projeto.membros.length > 0 && (
            <div>
              <span className="text-xs text-gray-400 block">Membros</span>
              <div className="flex -space-x-1 mt-0.5">
                {projeto.membros.slice(0, 5).map((m) => (
                  <div
                    key={m.id}
                    className="w-6 h-6 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-indigo-700 text-xs font-bold"
                    title={m.nome}
                  >
                    {m.nome.charAt(0).toUpperCase()}
                  </div>
                ))}
                {projeto.membros.length > 5 && (
                  <div className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-gray-600 text-xs">
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
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setVisao("kanban")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              visao === "kanban"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <LayoutGrid size={14} />
            Kanban
          </button>
          <button
            onClick={() => setVisao("lista")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              visao === "lista"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <List size={14} />
            Lista
          </button>
        </div>
        <button
          onClick={() => handleNovaTarefa("a_fazer")}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
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
                <div key={i} className="flex-shrink-0 w-72 h-64 bg-gray-100 rounded-xl animate-pulse" />
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
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loadingTarefas ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : tarefas.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <p>Nenhuma tarefa neste projeto.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tarefa</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Prioridade</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Responsável</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Prazo</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tarefas.map((tarefa) => (
                  <tr
                    key={tarefa.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleAbrirTarefa(tarefa)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {tarefa.titulo}
                      {tarefa.esta_atrasada && (
                        <AlertCircle size={12} className="inline ml-1 text-red-500" />
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
                    <td className="px-4 py-3 text-gray-600">
                      {tarefa.responsavel_nome ?? "—"}
                    </td>
                    <td
                      className={`px-4 py-3 ${
                        tarefa.esta_atrasada ? "text-red-600 font-medium" : "text-gray-600"
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
                          deletarTarefa(tarefa.id);
                        }}
                        className="text-gray-300 hover:text-red-500 transition-colors"
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
    </div>
  );
}
