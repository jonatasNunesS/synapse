"use client";
/**
 * Kanban da equipe na visão INDIVIDUAL (aba do perfil do membro).
 * Mostra as colunas da empresa com as tarefas pessoais e de projeto DAQUELE
 * membro. Admin cria/edita para o membro; membro comum só as próprias.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Settings2, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMembros, useKanbanEquipe } from "@/hooks/useEquipe";
import {
  criarTarefaPessoal,
  editarTarefaPessoal,
  apagarTarefaPessoal,
  moverTarefaPessoal,
} from "@/hooks/useEquipe";
import { getErrorMessage } from "@/lib/api";
import type { TarefaKanban, TarefaPessoalFormData } from "@/types/equipe";
import { EquipeKanbanBoard } from "./EquipeKanbanBoard";
import { TarefaPessoalModal } from "./TarefaPessoalModal";
import { EditarColunasModal } from "./EditarColunasModal";

interface Props {
  membroUsuarioId: string;
  membroNome: string;
}

export function KanbanEquipeIndividual({ membroUsuarioId, membroNome }: Props) {
  const router = useRouter();
  const { usuario } = useAuth();
  const isAdmin = usuario?.perfil === "admin";
  const { kanban, isLoading, mutate } = useKanbanEquipe(membroUsuarioId);
  const { membros } = useMembros();

  const [modalAberto, setModalAberto] = useState(false);
  const [tarefaEdit, setTarefaEdit] = useState<TarefaKanban | null>(null);
  const [colunaNova, setColunaNova] = useState<string | undefined>();
  const [editarColunas, setEditarColunas] = useState(false);

  const podeEditar = (t: TarefaKanban) =>
    isAdmin || t.responsavel?.id === usuario?.id;

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
    setColunaNova(undefined);
    setModalAberto(true);
  };

  const novaTarefa = (colunaId: string) => {
    setTarefaEdit(null);
    setColunaNova(colunaId);
    setModalAberto(true);
  };

  const salvar = async (dados: TarefaPessoalFormData, tarefaId?: string) => {
    if (tarefaId) await editarTarefaPessoal(tarefaId, dados);
    else await criarTarefaPessoal(dados);
    toast.success(tarefaId ? "Tarefa atualizada." : "Tarefa criada.");
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
    <div>
      <div className="flex items-center justify-end mb-2">
        {isAdmin && (
          <button
            onClick={() => setEditarColunas(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 text-xs font-medium hover:bg-slate-800"
          >
            <Settings2 className="h-3.5 w-3.5" /> Editar colunas
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
        </div>
      ) : (
        <EquipeKanbanBoard
          colunas={kanban.colunas}
          permiteCriar
          onNovaTarefa={novaTarefa}
          onAbrirTarefa={abrirTarefa}
          onMoverPessoal={mover}
        />
      )}

      <TarefaPessoalModal
        aberto={modalAberto}
        tarefa={tarefaEdit}
        colunaIdInicial={colunaNova}
        isAdmin={!!isAdmin}
        currentUserId={usuario?.id ?? ""}
        defaultResponsavel={membroUsuarioId}
        membros={membros.map((m) => ({ usuario_id: m.usuario_id, nome: m.nome }))}
        onSalvar={salvar}
        onApagar={tarefaEdit && podeEditar(tarefaEdit) ? apagar : undefined}
        onFechar={() => setModalAberto(false)}
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
