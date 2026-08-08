"use client";
/**
 * Kanban da equipe na VISÃO GERAL (aba na página /equipe).
 * Mostra tarefas de TODOS os membros nas mesmas colunas, com filtros por membro,
 * por prioridade e mostrar/ocultar tarefas de projeto. Cada card exibe o
 * responsável. Tarefas de projeto continuam read-only (clique redireciona).
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Settings2, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  useMembros,
  useKanbanEquipe,
  editarTarefaPessoal,
  apagarTarefaPessoal,
  moverTarefaPessoal,
} from "@/hooks/useEquipe";
import { getErrorMessage } from "@/lib/api";
import type { PrioridadeTarefa, TarefaKanban, TarefaPessoalFormData } from "@/types/equipe";
import { EquipeKanbanBoard } from "./EquipeKanbanBoard";
import { TarefaPessoalModal } from "./TarefaPessoalModal";
import { EditarColunasModal } from "./EditarColunasModal";

const PRIORIDADES: { value: PrioridadeTarefa; label: string }[] = [
  { value: "baixa", label: "Baixa" },
  { value: "media", label: "Média" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

export function KanbanEquipeGeral() {
  const router = useRouter();
  const { usuario } = useAuth();
  const isAdmin = usuario?.perfil === "admin";
  const { kanban, isLoading, mutate } = useKanbanEquipe(null);
  const { membros } = useMembros();

  const [membroFiltro, setMembroFiltro] = useState<string | null>(null);
  const [prioridadeFiltro, setPrioridadeFiltro] = useState<PrioridadeTarefa | "">("");
  const [mostrarProjeto, setMostrarProjeto] = useState(true);
  const [tarefaEdit, setTarefaEdit] = useState<TarefaKanban | null>(null);
  const [editarColunas, setEditarColunas] = useState(false);

  const colunasFiltradas = useMemo(() => {
    return kanban.colunas.map((col) => ({
      ...col,
      tarefas: col.tarefas.filter((t) => {
        if (membroFiltro && t.responsavel?.id !== membroFiltro) return false;
        if (prioridadeFiltro && t.prioridade !== prioridadeFiltro) return false;
        if (!mostrarProjeto && t.origem === "projeto") return false;
        return true;
      }),
    }));
  }, [kanban.colunas, membroFiltro, prioridadeFiltro, mostrarProjeto]);

  const podeEditar = (t: TarefaKanban) => isAdmin || t.responsavel?.id === usuario?.id;

  const abrirTarefa = (t: TarefaKanban) => {
    if (t.origem === "projeto") {
      toast.info("Mova esta tarefa no projeto.");
      if (t.projeto_id) router.push(`/projetos/${t.projeto_id}`);
      return;
    }
    if (!podeEditar(t)) {
      toast.info("Você só pode editar suas próprias tarefas.");
      return;
    }
    setTarefaEdit(t);
  };

  const salvar = async (dados: TarefaPessoalFormData, tarefaId?: string) => {
    if (!tarefaId) return;
    await editarTarefaPessoal(tarefaId, dados);
    toast.success("Tarefa atualizada.");
    mutate();
  };

  const apagar = async (tarefaId: string) => {
    await apagarTarefaPessoal(tarefaId);
    toast.success("Tarefa apagada.");
    mutate();
  };

  const mover = async (tarefaId: string, colunaId: string, ordem: number) => {
    try {
      await moverTarefaPessoal(tarefaId, colunaId, ordem);
      mutate();
    } catch (err) {
      toast.error(getErrorMessage(err), { duration: 7000 });
    }
  };

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setMembroFiltro(null)}
            className={chip(membroFiltro === null)}
          >
            Todos
          </button>
          {membros.map((m) => (
            <button
              key={m.usuario_id}
              onClick={() =>
                setMembroFiltro((cur) => (cur === m.usuario_id ? null : m.usuario_id))
              }
              className={chip(membroFiltro === m.usuario_id)}
            >
              {m.nome}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <select
            value={prioridadeFiltro}
            onChange={(e) => setPrioridadeFiltro(e.target.value as PrioridadeTarefa | "")}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            aria-label="Filtrar por prioridade"
          >
            <option value="">Toda prioridade</option>
            {PRIORIDADES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={mostrarProjeto}
              onChange={(e) => setMostrarProjeto(e.target.checked)}
              className="accent-brand-600"
            />
            Tarefas de projeto
          </label>
          {isAdmin && (
            <button
              onClick={() => setEditarColunas(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-xs font-medium hover:bg-slate-800"
            >
              <Settings2 className="h-3.5 w-3.5" /> Editar colunas
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        </div>
      ) : (
        <EquipeKanbanBoard
          colunas={colunasFiltradas}
          mostrarResponsavel
          onAbrirTarefa={abrirTarefa}
          onMoverPessoal={mover}
        />
      )}

      <TarefaPessoalModal
        aberto={!!tarefaEdit}
        tarefa={tarefaEdit}
        isAdmin={!!isAdmin}
        currentUserId={usuario?.id ?? ""}
        membros={membros.map((m) => ({ usuario_id: m.usuario_id, nome: m.nome }))}
        onSalvar={salvar}
        onApagar={tarefaEdit && podeEditar(tarefaEdit) ? apagar : undefined}
        onFechar={() => setTarefaEdit(null)}
      />

      {editarColunas && (
        <EditarColunasModal
          onFechar={() => setEditarColunas(false)}
          onMudou={() => mutate()}
        />
      )}
    </div>
  );
}

function chip(ativo: boolean): string {
  return `px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
    ativo
      ? "bg-brand-600 text-white"
      : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
  }`;
}
