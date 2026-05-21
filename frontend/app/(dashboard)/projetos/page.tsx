"use client";
/**
 * Synapse — M6: Página de Listagem de Projetos
 * Rota: /projetos
 */
import { useState } from "react";
import { Plus, Search, Filter, FolderOpen } from "lucide-react";
import { ProjetoCard } from "@/components/projetos/ProjetoCard";
import { ProjetoForm } from "@/components/projetos/ProjetoForm";
import { ResumoProjetosCards } from "@/components/projetos/ResumoProjetosCards";
import { useProjetos, useResumoProjetoss } from "@/hooks/useProjetos";
import type { ProjetoCreatePayload, ProjetoList, ProjetoStatus } from "@/types/projetos";

export default function ProjetosPage() {
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<ProjetoStatus | "">("");
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>("");
  const [modalAberto, setModalAberto] = useState(false);
  const [projetoEditando, setProjetoEditando] = useState<ProjetoList | null>(null);
  const [confirmandoDeletar, setConfirmandoDeletar] = useState<string | null>(null);

  const filtros: Record<string, string> = {};
  if (filtroStatus) filtros.status = filtroStatus;
  if (filtroPrioridade) filtros.prioridade = filtroPrioridade;
  if (busca) filtros.search = busca;

  const { projetos, loading, total, criar, atualizar, deletar } = useProjetos(filtros);
  const { resumo, loading: loadingResumo } = useResumoProjetoss();

  const handleSalvar = async (dados: ProjetoCreatePayload) => {
    if (projetoEditando) {
      await atualizar(projetoEditando.id, dados);
    } else {
      await criar(dados);
    }
    setModalAberto(false);
    setProjetoEditando(null);
  };

  const handleEditar = (projeto: ProjetoList) => {
    setProjetoEditando(projeto);
    setModalAberto(true);
  };

  const handleDeletar = async (id: string) => {
    if (confirmandoDeletar === id) {
      try {
        await deletar(id);
      } catch (err: unknown) {
        const e = err as { response?: { data?: { error?: { message?: string } } } };
        alert(e?.response?.data?.error?.message ?? "Não foi possível excluir o projeto.");
      }
      setConfirmandoDeletar(null);
    } else {
      setConfirmandoDeletar(id);
      setTimeout(() => setConfirmandoDeletar(null), 3000);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projetos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? "Carregando..." : `${total} projeto${total !== 1 ? "s" : ""} encontrado${total !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={() => {
            setProjetoEditando(null);
            setModalAberto(true);
          }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          Novo Projeto
        </button>
      </div>

      {/* Resumo */}
      {!loadingResumo && resumo && <ResumoProjetosCards resumo={resumo} />}
      {loadingResumo && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar projetos..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-gray-400" />
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as ProjetoStatus | "")}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todos os status</option>
            <option value="planejamento">Planejamento</option>
            <option value="em_andamento">Em Andamento</option>
            <option value="pausado">Pausado</option>
            <option value="concluido">Concluído</option>
            <option value="cancelado">Cancelado</option>
          </select>
          <select
            value={filtroPrioridade}
            onChange={(e) => setFiltroPrioridade(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todas as prioridades</option>
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>
        </div>
      </div>

      {/* Lista de Projetos */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-36 animate-pulse" />
          ))}
        </div>
      ) : projetos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <FolderOpen size={48} className="mb-3 opacity-40" />
          <p className="text-lg font-medium">Nenhum projeto encontrado</p>
          <p className="text-sm mt-1">
            {busca || filtroStatus || filtroPrioridade
              ? "Tente ajustar os filtros."
              : "Crie seu primeiro projeto clicando em \"Novo Projeto\"."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projetos.map((projeto) => (
            <div key={projeto.id} className="relative">
              <ProjetoCard
                projeto={projeto}
                onEditar={handleEditar}
                onDeletar={handleDeletar}
              />
              {confirmandoDeletar === projeto.id && (
                <div className="absolute inset-0 bg-red-50 border border-red-300 rounded-xl flex items-center justify-center gap-3 text-sm">
                  <span className="text-red-700 font-medium">Confirmar exclusão?</span>
                  <button
                    onClick={() => handleDeletar(projeto.id)}
                    className="bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700"
                  >
                    Excluir
                  </button>
                  <button
                    onClick={() => setConfirmandoDeletar(null)}
                    className="bg-gray-200 text-gray-700 px-3 py-1 rounded-lg hover:bg-gray-300"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <ProjetoForm
        aberto={modalAberto}
        projeto={projetoEditando}
        onFechar={() => {
          setModalAberto(false);
          setProjetoEditando(null);
        }}
        onSalvar={handleSalvar}
      />
    </div>
  );
}
