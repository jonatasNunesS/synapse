"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Search, Filter, RefreshCw } from "lucide-react";
import { ResumoCards } from "@/components/estoque/ResumoCards";
import { AlertasEstoque } from "@/components/estoque/AlertasEstoque";
import { ProdutoTable } from "@/components/estoque/ProdutoTable";
import { ProdutoForm } from "@/components/estoque/ProdutoForm";
import {
  useResumoEstoque,
  useAlertasEstoque,
  useProdutos,
  useCategoriasEstoque,
} from "@/hooks/useEstoque";
import type { ProdutoList, ProdutoCreate, FiltrosProduto, StatusEstoque } from "@/types/estoque";

export default function EstoquePage() {
  const { resumo, loading: loadingResumo, carregar: carregarResumo } = useResumoEstoque();
  const { alertas, loading: loadingAlertas, carregar: carregarAlertas } = useAlertasEstoque();
  const { produtos, paginacao, loading: loadingProdutos, listar, criar, atualizar, excluir } = useProdutos();
  const { categorias, listar: listarCategorias } = useCategoriasEstoque();

  const [filtros, setFiltros] = useState<FiltrosProduto>({ page: 1 });
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<StatusEstoque | "">("");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState<ProdutoList | null>(null);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregarTudo = useCallback(async (f: FiltrosProduto = filtros) => {
    await Promise.all([
      carregarResumo(),
      carregarAlertas(),
      listar(f),
    ]);
  }, [carregarResumo, carregarAlertas, listar, filtros]);

  useEffect(() => {
    listarCategorias();
    carregarTudo({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aplicarFiltros = useCallback(() => {
    const novosFiltros: FiltrosProduto = {
      busca: busca || undefined,
      status_estoque: statusFiltro || undefined,
      page: 1,
    };
    setFiltros(novosFiltros);
    listar(novosFiltros);
  }, [busca, statusFiltro, listar]);

  const handlePaginaChange = useCallback((pagina: number) => {
    const novosFiltros = { ...filtros, page: pagina };
    setFiltros(novosFiltros);
    listar(novosFiltros);
  }, [filtros, listar]);

  const handleSubmitForm = async (dados: ProdutoCreate) => {
    setSalvando(true);
    setErroForm(null);
    try {
      if (produtoEditando) {
        const resultado = await atualizar(produtoEditando.id, dados);
        if (!resultado) {
          setErroForm("Erro ao atualizar produto. Verifique os dados e tente novamente.");
          return;
        }
      } else {
        const resultado = await criar(dados);
        if (!resultado) {
          setErroForm("Erro ao criar produto. Verifique os dados e tente novamente.");
          return;
        }
      }
      setMostrarForm(false);
      setProdutoEditando(null);
      await carregarTudo();
    } finally {
      setSalvando(false);
    }
  };

  const handleEditar = (produto: ProdutoList) => {
    setProdutoEditando(produto as unknown as ProdutoList);
    setErroForm(null);
    setMostrarForm(true);
  };

  const handleExcluir = async (produto: ProdutoList) => {
    if (!confirm(`Deseja excluir o produto "${produto.nome}"?`)) return;
    const ok = await excluir(produto.id);
    if (ok) {
      await carregarTudo();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Estoque</h1>
          <p className="text-sm text-slate-400 mt-1">
            Gerencie seus produtos e movimentações
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => carregarTudo()}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Atualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setProdutoEditando(null);
              setErroForm(null);
              setMostrarForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            Novo Produto
          </button>
        </div>
      </div>

      {/* KPIs */}
      <ResumoCards resumo={resumo} loading={loadingResumo} />

      {/* Alertas + Tabela */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Alertas */}
        <div className="xl:col-span-1">
          <AlertasEstoque alertas={alertas} loading={loadingAlertas} />
        </div>

        {/* Tabela de Produtos */}
        <div className="xl:col-span-2 bg-[#0d1117] border border-white/10 rounded-xl overflow-hidden">
          {/* Filtros */}
          <div className="flex items-center gap-3 p-4 border-b border-white/10">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && aplicarFiltros()}
                placeholder="Buscar por nome, SKU ou código..."
                className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>
            <select
              value={statusFiltro}
              onChange={(e) => {
                setStatusFiltro(e.target.value as StatusEstoque | "");
                const novosFiltros: FiltrosProduto = {
                  busca: busca || undefined,
                  status_estoque: (e.target.value as StatusEstoque) || undefined,
                  page: 1,
                };
                setFiltros(novosFiltros);
                listar(novosFiltros);
              }}
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
            >
              <option value="" className="bg-[#0d1117]">Todos</option>
              <option value="ok" className="bg-[#0d1117]">OK</option>
              <option value="baixo" className="bg-[#0d1117]">Baixo</option>
              <option value="zerado" className="bg-[#0d1117]">Zerado</option>
            </select>
            <button
              onClick={aplicarFiltros}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Filter className="h-4 w-4" />
              Filtrar
            </button>
          </div>

          <ProdutoTable
            produtos={produtos}
            paginacao={paginacao}
            loading={loadingProdutos}
            onEditar={handleEditar}
            onExcluir={handleExcluir}
            onPaginaChange={handlePaginaChange}
          />
        </div>
      </div>

      {/* Modal de Produto */}
      {mostrarForm && (
        <ProdutoForm
          produto={null}
          categorias={categorias}
          onSubmit={handleSubmitForm}
          onFechar={() => {
            setMostrarForm(false);
            setProdutoEditando(null);
          }}
          loading={salvando}
          erro={erroForm}
        />
      )}
    </div>
  );
}
