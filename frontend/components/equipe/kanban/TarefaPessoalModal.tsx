"use client";
/**
 * Modal de criar/editar tarefa pessoal do Kanban da equipe.
 * - Admin vê o select de responsável (default: o membro do perfil em foco).
 * - Membro comum não vê o select (cria/edita só para si).
 */
import { useEffect, useState } from "react";
import { X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";
import type { TarefaKanban, TarefaPessoalFormData } from "@/types/equipe";

export interface MembroOpcao {
  usuario_id: string;
  nome: string;
}

interface Props {
  aberto: boolean;
  /** Tarefa a editar (pessoal). Ausente = criação. */
  tarefa?: TarefaKanban | null;
  colunaIdInicial?: string;
  isAdmin: boolean;
  currentUserId: string;
  /** Responsável default na criação (visão individual = membro do perfil). */
  defaultResponsavel?: string;
  membros: MembroOpcao[];
  onSalvar: (dados: TarefaPessoalFormData, tarefaId?: string) => Promise<void>;
  onApagar?: (tarefaId: string) => Promise<void>;
  onFechar: () => void;
}

export function TarefaPessoalModal({
  aberto,
  tarefa,
  colunaIdInicial,
  isAdmin,
  currentUserId,
  defaultResponsavel,
  membros,
  onSalvar,
  onApagar,
  onFechar,
}: Props) {
  const editando = !!tarefa;
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState<"baixa" | "media" | "alta">("media");
  const [prazo, setPrazo] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    if (tarefa) {
      setTitulo(tarefa.titulo);
      setDescricao(tarefa.descricao ?? "");
      setPrioridade((tarefa.prioridade === "urgente" ? "alta" : tarefa.prioridade) as "baixa" | "media" | "alta");
      setPrazo(tarefa.prazo ?? "");
      setResponsavel(tarefa.responsavel?.id ?? currentUserId);
    } else {
      setTitulo("");
      setDescricao("");
      setPrioridade("media");
      setPrazo("");
      setResponsavel(isAdmin ? defaultResponsavel ?? currentUserId : currentUserId);
    }
  }, [aberto, tarefa, isAdmin, defaultResponsavel, currentUserId]);

  if (!aberto) return null;

  const salvar = async () => {
    if (!titulo.trim() || salvando) return;
    setSalvando(true);
    try {
      const dados: TarefaPessoalFormData = {
        coluna: tarefa?.coluna_id ?? colunaIdInicial ?? "",
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        prazo: prazo || null,
        prioridade,
        responsavel: isAdmin ? responsavel : currentUserId,
      };
      await onSalvar(dados, tarefa?.id);
      onFechar();
    } catch (err) {
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setSalvando(false);
    }
  };

  const apagar = async () => {
    if (!tarefa || !onApagar) return;
    setSalvando(true);
    try {
      await onApagar(tarefa.id);
      onFechar();
    } catch (err) {
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">
            {editando ? "Editar tarefa" : "Nova tarefa"}
          </h2>
          <button onClick={onFechar} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Título *</label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              autoFocus
              className={inputCls}
              placeholder="O que precisa ser feito?"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Descrição</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              className={`${inputCls} resize-none`}
              placeholder="Detalhes (opcional)"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Prioridade</label>
              <select
                value={prioridade}
                onChange={(e) => setPrioridade(e.target.value as "baixa" | "media" | "alta")}
                className={inputCls}
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Prazo</label>
              <input
                type="date"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          {isAdmin && (
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Responsável</label>
              <select
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                className={inputCls}
              >
                {membros.map((m) => (
                  <option key={m.usuario_id} value={m.usuario_id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border">
          {editando && onApagar ? (
            <button
              onClick={apagar}
              disabled={salvando}
              className="inline-flex items-center gap-1.5 text-sm text-erro hover:text-erro disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> Apagar
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onFechar}
              className="px-3 py-2 rounded-lg text-sm text-foreground-suave hover:bg-secondary"
            >
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={!titulo.trim() || salvando}
              className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {editando ? "Salvar" : "Criar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-white placeholder:text-muted-suave focus:outline-none focus:ring-1 focus:ring-brand-500";
