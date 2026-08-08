"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { List, Kanban, RefreshCw, Zap } from "lucide-react";
import { getErrorMessage } from "@/lib/api";
import { ResumoCards } from "@/components/clientes/ResumoCards";
import { ClienteTable } from "@/components/clientes/ClienteTable";
import { FunilKanban } from "@/components/clientes/FunilKanban";
import { ClienteForm } from "@/components/clientes/ClienteForm";
import { NovaInteracaoRapidaModal } from "@/components/clientes/NovaInteracaoRapidaModal";
import { PeriodoSelector, type Periodo } from "@/components/clientes/PeriodoSelector";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useClientes, useFunilKanban, useResumoClientes } from "@/hooks/useClientes";
import type { FiltrosClientes } from "@/hooks/useClientes";
import type { ClienteList } from "@/types/clientes";

type ViewMode = "lista" | "kanban";

export default function ClientesPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("lista");
  const [showForm, setShowForm] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<ClienteList | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [clienteParaExcluir, setClienteParaExcluir] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  // Atalho de nova interação: aberto e (opcionalmente) com um cliente fixo.
  const [showInteracaoRapida, setShowInteracaoRapida] = useState(false);
  const [clienteInteracao, setClienteInteracao] =
    useState<{ id: string; nome: string } | null>(null);

  const abrirInteracaoRapida = (cliente: { id: string; nome: string } | null) => {
    setClienteInteracao(cliente);
    setShowInteracaoRapida(true);
  };

  const { clientes, pagination, loading, carregar, criar, atualizar, deletar } = useClientes();
  const { funil, loading: funilLoading, carregar: carregarFunil, moverCard } = useFunilKanban();
  const { resumo, loading: resumoLoading, carregar: carregarResumo } = useResumoClientes();

  // Filtro de período (Mês + Ano) e os filtros da tabela (busca/status/etc.)
  // convivem: ambos entram em toda recarga.
  const [periodo, setPeriodo] = useState<Periodo | null>(null);
  const [filtrosTabela, setFiltrosTabela] = useState<FiltrosClientes>({});

  const carregarTudo = useCallback(async () => {
    const p = periodo ?? {};
    await Promise.all([
      carregar({ ...filtrosTabela, ...p, page }),
      carregarFunil(),
      carregarResumo(periodo ?? undefined),
    ]);
  }, [carregar, carregarFunil, carregarResumo, page, periodo, filtrosTabela]);

  useEffect(() => {
    carregarTudo();
  }, [carregarTudo]);

  const handleSubmit = async (dados: Parameters<typeof criar>[0]) => {
    setFormLoading(true);
    try {
      if (clienteEditando) {
        await atualizar(clienteEditando.id, dados);
        toast.success("Cliente atualizado.");
      } else {
        await criar(dados);
        toast.success("Cliente criado.");
      }
      setShowForm(false);
      setClienteEditando(null);
      carregarTudo();
    } catch (err) {
      // Mantém o modal aberto para o usuário corrigir
      toast.error(getErrorMessage(err));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeletar = (id: string) => {
    setClienteParaExcluir(id);
  };

  const handleConfirmarExclusao = async () => {
    if (!clienteParaExcluir || excluindo) return; // evita duplo clique
    setExcluindo(true);
    try {
      await deletar(clienteParaExcluir);
      toast.success("Cliente excluído.");
      setClienteParaExcluir(null);
      carregarTudo();
    } catch (err) {
      // Erro NUNCA calado: mostra a mensagem real do backend
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setExcluindo(false);
    }
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
                  ? "bg-brand-600 text-white"
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
                  ? "bg-brand-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              Kanban
            </button>
          </div>

          <button
            onClick={() => abrirInteracaoRapida(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs text-white font-medium transition-colors"
          >
            <Zap className="w-3.5 h-3.5" />
            Nova interação
          </button>

          <PeriodoSelector
            periodo={periodo}
            onChange={(p) => {
              setPeriodo(p);
              setPage(1);
            }}
          />

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
      <ResumoCards resumo={resumo} loading={resumoLoading} periodoAtivo={!!periodo} />

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
          onNovaInteracao={(c) => abrirInteracaoRapida({ id: c.id, nome: c.nome })}
          onFiltrar={(filtros) => {
            setFiltrosTabela(filtros);
            setPage(1);
            carregar({ ...filtros, ...(periodo ?? {}), page: 1 });
          }}
          pagination={{ count: pagination.count, page }}
          onPageChange={(p) => {
            setPage(p);
            carregar({ ...filtrosTabela, ...(periodo ?? {}), page: p });
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
              className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-xs text-white font-medium transition-colors"
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

      {/* Atalho: nova interação (global ou por cliente) */}
      {showInteracaoRapida && (
        <NovaInteracaoRapidaModal
          clienteInicial={clienteInteracao}
          onClose={() => setShowInteracaoRapida(false)}
          onCriada={carregarTudo}
        />
      )}

      <ConfirmDialog
        open={!!clienteParaExcluir}
        titulo="Excluir cliente"
        mensagem="Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        processando={excluindo}
        onConfirm={handleConfirmarExclusao}
        onCancel={() => setClienteParaExcluir(null)}
      />
    </div>
  );
}
