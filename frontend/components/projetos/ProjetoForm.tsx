"use client";
/**
 * Synapse — M6: Formulário de criação/edição de Projeto (Modal)
 */
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { ProjetoCreatePayload, ProjetoList } from "@/types/projetos";

interface ProjetoFormProps {
  aberto: boolean;
  projeto?: ProjetoList | null;
  onFechar: () => void;
  onSalvar: (dados: ProjetoCreatePayload) => Promise<void>;
}

const CORES_PRESET = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#0ea5e9", "#64748b",
];

export function ProjetoForm({ aberto, projeto, onFechar, onSalvar }: ProjetoFormProps) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<ProjetoCreatePayload>({
    nome: "",
    descricao: "",
    status: "planejamento",
    prioridade: "media",
    data_inicio: "",
    data_prazo: "",
    cor: "#6366f1",
  });

  useEffect(() => {
    if (projeto) {
      setDados({
        nome: projeto.nome,
        descricao: "",
        status: projeto.status,
        prioridade: projeto.prioridade,
        data_inicio: projeto.data_inicio ?? "",
        data_prazo: projeto.data_prazo ?? "",
        cor: projeto.cor || "#6366f1",
      });
    } else {
      setDados({
        nome: "",
        descricao: "",
        status: "planejamento",
        prioridade: "media",
        data_inicio: "",
        data_prazo: "",
        cor: "#6366f1",
      });
    }
    setErro(null);
  }, [projeto, aberto]);

  if (!aberto) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dados.nome.trim()) {
      setErro("O nome do projeto é obrigatório.");
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      await onSalvar(dados);
      onFechar();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      setErro(e?.response?.data?.error?.message ?? "Erro ao salvar projeto.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {projeto ? "Editar Projeto" : "Novo Projeto"}
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

          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={dados.nome}
              onChange={(e) => setDados({ ...dados, nome: e.target.value })}
              placeholder="Ex: Lançamento do Produto X"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              maxLength={200}
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
              placeholder="Descreva o objetivo do projeto..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
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
                  setDados({ ...dados, status: e.target.value as ProjetoCreatePayload["status"] })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="planejamento">Planejamento</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="pausado">Pausado</option>
                <option value="concluido">Concluído</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prioridade
              </label>
              <select
                value={dados.prioridade}
                onChange={(e) =>
                  setDados({ ...dados, prioridade: e.target.value as ProjetoCreatePayload["prioridade"] })
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data de Início
              </label>
              <input
                type="date"
                value={dados.data_inicio ?? ""}
                onChange={(e) => setDados({ ...dados, data_inicio: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prazo
              </label>
              <input
                type="date"
                value={dados.data_prazo ?? ""}
                onChange={(e) => setDados({ ...dados, data_prazo: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Cor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cor do Projeto
            </label>
            <div className="flex gap-2 flex-wrap">
              {CORES_PRESET.map((cor) => (
                <button
                  key={cor}
                  type="button"
                  onClick={() => setDados({ ...dados, cor })}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    dados.cor === cor ? "scale-125 ring-2 ring-offset-1 ring-gray-400" : ""
                  }`}
                  style={{ backgroundColor: cor }}
                  title={cor}
                />
              ))}
            </div>
          </div>

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
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60"
            >
              {loading ? "Salvando..." : projeto ? "Salvar" : "Criar Projeto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
