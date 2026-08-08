"use client";
/**
 * Synapse — M6: Formulário de criação/edição de Tarefa (Modal)
 */
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { TarefaCreatePayload, TarefaDetail, TarefaStatus } from "@/types/projetos";
import type { ApiError } from "@/types/api";
import { useAuth } from "@/hooks/useAuth";
import { useColunasEquipe } from "@/hooks/useEquipe";
import { useModulos } from "@/hooks/useModulos";

interface TarefaFormProps {
  aberto: boolean;
  tarefa?: TarefaDetail | null;
  statusInicial?: TarefaStatus;
  onFechar: () => void;
  onSalvar: (dados: TarefaCreatePayload) => Promise<void>;
}

export function TarefaForm({
  aberto,
  tarefa,
  statusInicial = "a_fazer",
  onFechar,
  onSalvar,
}: TarefaFormProps) {
  const { usuario } = useAuth();
  const { moduloAtivo } = useModulos();
  // O campo de coluna do Kanban da Equipe só existe se o módulo Equipe
  // estiver ativo (e só para admin).
  const isAdmin = usuario?.perfil === "admin" && moduloAtivo("equipe");
  // Colunas do Kanban da equipe — só carregam/exibem para admin.
  const { colunas } = useColunasEquipe();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<TarefaCreatePayload>({
    titulo: "",
    descricao: "",
    status: statusInicial,
    prioridade: "media",
    data_prazo: "",
    estimativa_horas: "",
    coluna_kanban_equipe: null,
  });

  useEffect(() => {
    if (tarefa) {
      setDados({
        titulo: tarefa.titulo,
        descricao: tarefa.descricao ?? "",
        status: tarefa.status,
        prioridade: tarefa.prioridade,
        data_prazo: tarefa.data_prazo ?? "",
        estimativa_horas: tarefa.estimativa_horas ?? "",
        coluna_kanban_equipe: tarefa.coluna_kanban_equipe ?? null,
      });
    } else {
      setDados({
        titulo: "",
        descricao: "",
        status: statusInicial,
        prioridade: "media",
        data_prazo: "",
        estimativa_horas: "",
        coluna_kanban_equipe: null,
      });
    }
    setErro(null);
  }, [tarefa, aberto, statusInicial]);

  if (!aberto) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dados.titulo.trim()) {
      setErro("O título da tarefa é obrigatório.");
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      await onSalvar(dados);
      onFechar();
    } catch (err: unknown) {
      const e = err as ApiError;
      setErro(e?.error?.message ?? "Erro ao salvar tarefa.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {tarefa ? "Editar Tarefa" : "Nova Tarefa"}
          </h2>
          <button
            onClick={onFechar}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {erro && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-2 rounded-lg border border-red-200">
              {erro}
            </div>
          )}

          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Título <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={dados.titulo}
              onChange={(e) => setDados({ ...dados, titulo: e.target.value })}
              placeholder="Ex: Criar wireframes da tela inicial"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              maxLength={300}
              autoFocus
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descrição
            </label>
            <textarea
              value={dados.descricao}
              onChange={(e) => setDados({ ...dados, descricao: e.target.value })}
              placeholder="Detalhes da tarefa..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          {/* Status + Prioridade */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={dados.status}
                onChange={(e) =>
                  setDados({ ...dados, status: e.target.value as TarefaStatus })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="a_fazer">A Fazer</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="revisao">Revisão</option>
                <option value="concluido">Concluído</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prioridade
              </label>
              <select
                value={dados.prioridade}
                onChange={(e) =>
                  setDados({
                    ...dados,
                    prioridade: e.target.value as TarefaCreatePayload["prioridade"],
                  })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>

          {/* Prazo + Estimativa */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prazo
              </label>
              <input
                type="date"
                value={dados.data_prazo ?? ""}
                onChange={(e) => setDados({ ...dados, data_prazo: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimativa (h)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={dados.estimativa_horas ?? ""}
                onChange={(e) =>
                  setDados({ ...dados, estimativa_horas: e.target.value || null })
                }
                placeholder="Ex: 4.5"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Coluna no Kanban da Equipe (só admin) */}
          {isAdmin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Coluna no Kanban da Equipe
              </label>
              <select
                value={dados.coluna_kanban_equipe ?? ""}
                onChange={(e) =>
                  setDados({ ...dados, coluna_kanban_equipe: e.target.value || null })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Não exibir no Kanban</option>
                {colunas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Onde esta tarefa aparece no Kanban da equipe (read-only lá).
              </p>
            </div>
          )}

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onFechar}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-60"
            >
              {loading ? "Salvando..." : tarefa ? "Salvar" : "Criar Tarefa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
