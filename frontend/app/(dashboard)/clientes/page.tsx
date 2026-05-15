"use client";

import { useEffect, useState, useCallback } from "react";
import { List, Kanban, RefreshCw } from "lucide-react";
import { ResumoCards } from "@/components/clientes/ResumoCards";
import { ClienteTable } from "@/components/clientes/ClienteTable";
import { FunilKanban } from "@/components/clientes/FunilKanban";
import { ClienteForm } from "@/components/clientes/ClienteForm";
import { useClientes, useFunilKanban, useResumoClientes } from "@/hooks/useClientes";
import type { ClienteList } from "@/types/clientes";

type ViewMode = "lista" | "kanban";

export default function ClientesPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("lista");
  const [showForm, setShowForm] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<ClienteList | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [page, setPage] = useState(1);

  const { clientes, pagination, loading, carregar, criar, atualizar, deletar } = useClientes();
  const { funil, loading: funilLoading, carregar: carregarFunil, moverCard } = useFunilKanban();
  const { resumo, loading: resumoLoading, carregar: carregarResumo } = useResumoClientes();

  const carregarTudo = useCallback(async () => {
    await Promise.all([
      carregar({ page }),
      carregarFunil(),
      carregarResumo(),
    ]);
  }, [carregar, carregarFunil, carregarResumo, page]);

  useEffect(() => {
    carregarTudo();
  }, [carregarTudo]);

  const handleSubmit = async (dados: Parameters<typeof criar>[0]) => {
    setFormLoading(true);
    try {
      if (clienteEditando) {
        await atualizar(clienteEditando.id, dados);
      } else {
        await criar(dados);
      }
      setShowForm(false);
      setClienteEditando(null);
      carregarTudo();
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeletar = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este cliente?")) return;
    const ok = await deletar(id);
    if (ok) carregarTudo();
  };

  const handleEditar = (cliente: ClienteList) => {
    setClienteEditando(cliente);
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">CRM — Clientes</h1>
          <p className="text-sm text-gray-400 mt-1">
            Gerencie seus clientes e acompanhe o funil de vendas
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle de view */}
          <div className="flex bg-white/5 border border-white/10 rounded-lg p-1">
            <button
              onClick={() => setViewMode("lista")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                viewMode === "lista"
                  ? "bg-purple-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Lista
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                viewMode === "kanban"
                  ? "bg-purple-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              Kanban
            </button>
          </div>

          <button
            onClick={carregarTudo}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Atualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <ResumoCards resumo={resumo} loading={resumoLoading} />

      {/* Conteúdo principal */}
      {viewMode === "lista" ? (
        <ClienteTable
          clientes={clientes}
          loading={loading}
          onNovo={() => {
            setClienteEditando(null);
            setShowForm(true);
          }}
          onEditar={handleEditar}
          onDeletar={handleDeletar}
          onFiltrar={(filtros) => carregar({ ...filtros, page: 1 })}
          pagination={{ count: pagination.count, page }}
          onPageChange={(p) => {
            setPage(p);
            carregar({ page: p });
          }}
        />
      ) : (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-400">
              Arraste os cards para mover clientes entre etapas do funil
            </h2>
            <button
              onClick={() => {
                setClienteEditando(null);
                setShowForm(true);
              }}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-xs text-white font-medium transition-colors"
            >
              + Novo Cliente
            </button>
          </div>
          <FunilKanban
            funil={funil}
            loading={funilLoading}
            onMover={moverCard}
          />
        </div>
      )}

      {/* Modal de formulário */}
      {showForm && (
        <ClienteForm
          cliente={clienteEditando as Parameters<typeof ClienteForm>[0]["cliente"]}
          onSubmit={handleSubmit}
          onClose={() => {
            setShowForm(false);
            setClienteEditando(null);
          }}
          loading={formLoading}
        />
      )}
    </div>
  );
}
