"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api";
import {
  ArrowLeft,
  Package,
  Edit2,
  Plus,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { HistoricoMovimentacoes } from "@/components/estoque/HistoricoMovimentacoes";
import { MovimentacaoForm, type MovimentacaoFormData } from "@/components/estoque/MovimentacaoForm";
import { ProdutoForm } from "@/components/estoque/ProdutoForm";
import { useProdutos, useMovimentacoes, useCategoriasEstoque } from "@/hooks/useEstoque";
import type { ProdutoDetail, ProdutoCreate } from "@/types/estoque";

function InfoCard({
  titulo,
  valor,
  sub,
  icone: Icon,
  cor,
  bg,
}: {
  titulo: string;
  valor: string;
  sub?: string;
  icone: typeof Package;
  cor: string;
  bg: string;
}) {
  return (
    <div className="bg-[#0d1117] border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400">{titulo}</span>
        <div className={`p-1.5 rounded-lg ${bg}`}>
          <Icon className={`h-4 w-4 ${cor}`} />
        </div>
      </div>
      <div className="text-xl font-bold text-white">{valor}</div>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function ProdutoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { obter, atualizar } = useProdutos();
  const { movimentacoes, paginacao, loading: loadingMov, listar: listarMov, registrar } = useMovimentacoes();
  const { categorias, listar: listarCategorias } = useCategoriasEstoque();

  const [produto, setProduto] = useState<ProdutoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [mostrarMovForm, setMostrarMovForm] = useState(false);
  const [mostrarEditForm, setMostrarEditForm] = useState(false);
  const [salvandoMov, setSalvandoMov] = useState(false);
  const [salvandoEdit, setSalvandoEdit] = useState(false);
  const [erroMov, setErroMov] = useState<string | null>(null);
  const [erroEdit, setErroEdit] = useState<string | null>(null);

  const carregarProduto = useCallback(async () => {
    setLoading(true);
    const p = await obter(id);
    if (!p) {
      router.push("/estoque");
      return;
    }
    setProduto(p);
    setLoading(false);
  }, [id, obter, router]);

  useEffect(() => {
    carregarProduto();
    listarCategorias();
    listarMov(id, { page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleRegistrarMovimentacao = async (dados: MovimentacaoFormData) => {
    setSalvandoMov(true);
    setErroMov(null);
    try {
      await registrar({ ...dados, produto: id });
      toast.success("Movimentação registrada.");
      setMostrarMovForm(false);
      await carregarProduto();
      await listarMov(id, { page: 1 });
    } catch (err) {
      // Exibe o motivo real retornado pelo backend e mantém o modal aberto
      setErroMov(getErrorMessage(err));
    } finally {
      setSalvandoMov(false);
    }
  };

  const handleAtualizarProduto = async (dados: ProdutoCreate) => {
    setSalvandoEdit(true);
    setErroEdit(null);
    try {
      await atualizar(id, dados);
      toast.success("Produto atualizado.");
      setMostrarEditForm(false);
      await carregarProduto();
    } catch (err) {
      setErroEdit(getErrorMessage(err));
    } finally {
      setSalvandoEdit(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-white/10 rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-white/10 rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-white/10 rounded-xl" />
      </div>
    );
  }

  if (!produto) return null;

  const statusConfig = {
    ok: { cor: "text-emerald-400", bg: "bg-emerald-500/10", icone: CheckCircle, label: "Estoque OK" },
    baixo: { cor: "text-amber-400", bg: "bg-amber-500/10", icone: AlertTriangle, label: "Estoque Baixo" },
    zerado: { cor: "text-red-400", bg: "bg-red-500/10", icone: AlertTriangle, label: "Sem Estoque" },
  };
  const status = statusConfig[produto.status_estoque];

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/estoque"
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Estoque
          </Link>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
              {produto.imagem_url ? (
                <img
                  src={produto.imagem_url}
                  alt={produto.nome}
                  className="h-10 w-10 rounded-xl object-cover"
                />
              ) : (
                <Package className="h-5 w-5 text-slate-400" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{produto.nome}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                {produto.sku && (
                  <span className="text-xs text-slate-500 font-mono">
                    SKU: {produto.sku}
                  </span>
                )}
                {produto.categoria_nome && (
                  <>
                    <span className="text-slate-700">·</span>
                    <div className="flex items-center gap-1">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: produto.categoria_cor || "#6b7280" }}
                      />
                      <span className="text-xs text-slate-500">
                        {produto.categoria_nome}
                      </span>
                    </div>
                  </>
                )}
                <span className="text-slate-700">·</span>
                <span className={`text-xs font-medium ${status.cor}`}>
                  {status.label}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setErroEdit(null);
              setMostrarEditForm(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-colors text-sm"
          >
            <Edit2 className="h-4 w-4" />
            Editar
          </button>
          <button
            onClick={() => {
              setErroMov(null);
              setMostrarMovForm(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            Movimentação
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <InfoCard
          titulo="Estoque Atual"
          valor={`${Number(produto.estoque_atual).toLocaleString("pt-BR")} ${produto.unidade}`}
          sub={`Mínimo: ${Number(produto.estoque_minimo).toLocaleString("pt-BR")}`}
          icone={Package}
          cor={status.cor}
          bg={status.bg}
        />
        <InfoCard
          titulo="Valor em Estoque"
          valor={new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(produto.valor_em_estoque)}
          sub="Custo × Estoque atual"
          icone={DollarSign}
          cor="text-emerald-400"
          bg="bg-emerald-500/10"
        />
        <InfoCard
          titulo="Preço de Venda"
          valor={new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(Number(produto.preco_venda))}
          sub={
            produto.margem_lucro != null
              ? `Margem: ${produto.margem_lucro.toFixed(1)}%`
              : undefined
          }
          icone={TrendingUp}
          cor="text-blue-400"
          bg="bg-blue-500/10"
        />
        <InfoCard
          titulo="Movimentações"
          valor={produto.total_movimentacoes.toLocaleString("pt-BR")}
          sub="Total registrado"
          icone={Package}
          cor="text-purple-400"
          bg="bg-purple-500/10"
        />
      </div>

      {/* Descrição */}
      {produto.descricao && (
        <div className="bg-[#0d1117] border border-white/10 rounded-xl p-5">
          <h3 className="text-sm font-medium text-slate-400 mb-2">Descrição</h3>
          <p className="text-sm text-slate-300">{produto.descricao}</p>
        </div>
      )}

      {/* Histórico de Movimentações */}
      <div className="bg-[#0d1117] border border-white/10 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h3 className="font-semibold text-white">Histórico de Movimentações</h3>
          <span className="text-xs text-slate-500">
            {paginacao.total} registro{paginacao.total !== 1 ? "s" : ""}
          </span>
        </div>
        <HistoricoMovimentacoes
          movimentacoes={movimentacoes}
          paginacao={paginacao}
          loading={loadingMov}
          onPaginaChange={(pagina) => listarMov(id, { page: pagina })}
        />
      </div>

      {/* Modal de Movimentação */}
      {mostrarMovForm && (
        <MovimentacaoForm
          produto={produto}
          onSubmit={handleRegistrarMovimentacao}
          onFechar={() => setMostrarMovForm(false)}
          loading={salvandoMov}
          erro={erroMov}
        />
      )}

      {/* Modal de Edição */}
      {mostrarEditForm && (
        <ProdutoForm
          produto={produto}
          categorias={categorias}
          onSubmit={handleAtualizarProduto}
          onFechar={() => setMostrarEditForm(false)}
          loading={salvandoEdit}
          erro={erroEdit}
        />
      )}
    </div>
  );
}
