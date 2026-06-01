"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Package, Plus, Search, ArrowRight, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import api from "@/lib/api";

interface ProdutoBasico {
  id: string;
  nome: string;
  sku: string;
  estoque_atual: number;
  unidade: string;
}

interface CompraInfo {
  id: string;
  fornecedor_id: string;
  descricao: string;
  valor: number;
}

interface AdicionarAoEstoqueModalProps {
  compra: CompraInfo;
  onClose: () => void;
  onSuccess?: () => void;
}

type Passo = "escolha" | "produto_existente" | "produto_novo" | "sucesso";

export function AdicionarAoEstoqueModal({ compra, onClose, onSuccess }: AdicionarAoEstoqueModalProps) {
  const [passo, setPasso] = useState<Passo>("escolha");
  const [produtos, setProdutos] = useState<ProdutoBasico[]>([]);
  const [busca, setBusca] = useState("");
  const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoBasico | null>(null);
  const [quantidade, setQuantidade] = useState("1");
  const [nomeProduto, setNomeProduto] = useState("");
  const [precoCusto, setPrecoCusto] = useState(String(compra.valor));
  const [precoVenda, setPrecoVenda] = useState("");
  const [estoqueMinimo, setEstoqueMinimo] = useState("0");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ produto_nome: string; estoque_atual: number } | null>(null);

  const carregarProdutos = useCallback(async () => {
    try {
      const res = await api.get<{ data: { results?: ProdutoBasico[]; data?: ProdutoBasico[] } }>(
        `/estoque/produtos/?ativo=true&busca=${encodeURIComponent(busca)}&page_size=50`
      );
      const lista = res.data?.data;
      if (Array.isArray(lista)) setProdutos(lista);
    } catch {
      // silencioso
    }
  }, [busca]);

  useEffect(() => {
    if (passo === "produto_existente") {
      carregarProdutos();
    }
  }, [passo, busca, carregarProdutos]);

  const handleSubmit = async () => {
    setErro(null);
    const qtd = parseFloat(quantidade);
    if (!qtd || qtd <= 0) {
      setErro("Informe uma quantidade válida.");
      return;
    }

    setLoading(true);
    try {
      let body: Record<string, unknown>;
      if (passo === "produto_existente") {
        if (!produtoSelecionado) { setErro("Selecione um produto."); setLoading(false); return; }
        body = { produto_id: produtoSelecionado.id, quantidade: qtd };
      } else {
        if (!nomeProduto.trim()) { setErro("Informe o nome do produto."); setLoading(false); return; }
        body = {
          criar_produto: true,
          quantidade: qtd,
          dados_produto: {
            nome: nomeProduto.trim(),
            preco_custo: parseFloat(precoCusto) || 0,
            preco_venda: parseFloat(precoVenda) || 0,
            estoque_minimo: parseFloat(estoqueMinimo) || 0,
          },
        };
      }

      const res = await api.post<{ data: { produto_nome: string; estoque_atual: number } }>(
        `/fornecedores/${compra.fornecedor_id}/compras/${compra.id}/adicionar-ao-estoque/`,
        body
      );
      setResultado(res.data.data);
      setPasso("sucesso");
      onSuccess?.();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setErro(err?.response?.data?.message || "Erro ao registrar entrada no estoque.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Package className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800 text-sm">Adicionar ao Estoque</h2>
              <p className="text-xs text-slate-500 truncate max-w-[220px]">{compra.descricao}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Passo: escolha */}
          {passo === "escolha" && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 mb-4">Como deseja registrar esta entrada no estoque?</p>
              <button
                onClick={() => setPasso("produto_existente")}
                className="w-full flex items-center gap-3 p-4 border-2 border-slate-200 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-all text-left"
              >
                <Search className="h-5 w-5 text-purple-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-800">Produto existente</p>
                  <p className="text-xs text-slate-500">Vincular a um produto já cadastrado</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 ml-auto" />
              </button>
              <button
                onClick={() => setPasso("produto_novo")}
                className="w-full flex items-center gap-3 p-4 border-2 border-slate-200 rounded-xl hover:border-emerald-400 hover:bg-emerald-50 transition-all text-left"
              >
                <Plus className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-800">Criar novo produto</p>
                  <p className="text-xs text-slate-500">Cadastrar e já dar entrada no estoque</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 ml-auto" />
              </button>
              <button onClick={onClose} className="w-full text-xs text-slate-400 hover:text-slate-600 mt-2">
                Pular por agora
              </button>
            </div>
          )}

          {/* Passo: produto existente */}
          {passo === "produto_existente" && (
            <div className="space-y-4">
              <Input
                placeholder="Buscar produto..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="text-sm"
              />
              <div className="max-h-44 overflow-y-auto space-y-1 border rounded-lg p-1">
                {produtos.length === 0 && (
                  <p className="text-xs text-slate-400 p-3 text-center">Nenhum produto encontrado.</p>
                )}
                {produtos.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setProdutoSelecionado(p)}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      produtoSelecionado?.id === p.id
                        ? "bg-purple-100 text-purple-800"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <span className="font-medium">{p.nome}</span>
                    {p.sku && <span className="text-xs text-slate-400 ml-2">#{p.sku}</span>}
                    <span className="float-right text-xs text-slate-400">{p.estoque_atual} {p.unidade}</span>
                  </button>
                ))}
              </div>
              <div>
                <Label className="text-xs">Quantidade a adicionar *</Label>
                <Input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  className="text-sm mt-1"
                />
              </div>
              {erro && <p className="text-xs text-red-500">{erro}</p>}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setPasso("escolha")} className="flex-1">Voltar</Button>
                <Button size="sm" onClick={handleSubmit} disabled={loading || !produtoSelecionado} className="flex-1 bg-purple-600 hover:bg-purple-700">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar Entrada"}
                </Button>
              </div>
            </div>
          )}

          {/* Passo: produto novo */}
          {passo === "produto_novo" && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Nome do produto *</Label>
                <Input value={nomeProduto} onChange={(e) => setNomeProduto(e.target.value)} placeholder="Ex: Caixa de parafusos" className="text-sm mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Preço de custo</Label>
                  <Input type="number" min="0" step="0.01" value={precoCusto} onChange={(e) => setPrecoCusto(e.target.value)} className="text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Preço de venda</Label>
                  <Input type="number" min="0" step="0.01" value={precoVenda} onChange={(e) => setPrecoVenda(e.target.value)} className="text-sm mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Estoque mínimo</Label>
                  <Input type="number" min="0" step="1" value={estoqueMinimo} onChange={(e) => setEstoqueMinimo(e.target.value)} className="text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Quantidade inicial *</Label>
                  <Input type="number" min="0.001" step="0.001" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} className="text-sm mt-1" />
                </div>
              </div>
              {erro && <p className="text-xs text-red-500">{erro}</p>}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setPasso("escolha")} className="flex-1">Voltar</Button>
                <Button size="sm" onClick={handleSubmit} disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar e Dar Entrada"}
                </Button>
              </div>
            </div>
          )}

          {/* Passo: sucesso */}
          {passo === "sucesso" && resultado && (
            <div className="text-center py-4">
              <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
              <p className="font-semibold text-slate-800">Entrada registrada!</p>
              <p className="text-sm text-slate-600 mt-1">
                <span className="font-medium">{resultado.produto_nome}</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Estoque atual: <span className="font-semibold text-slate-700">{resultado.estoque_atual}</span>
              </p>
              <Button onClick={onClose} className="mt-5 w-full bg-slate-800 hover:bg-slate-900">Fechar</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
