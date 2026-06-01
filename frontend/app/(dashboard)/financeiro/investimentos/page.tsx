"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  RefreshCw,
  DollarSign,
  BarChart3,
} from "lucide-react";
import { useInvestimentos, type Investimento, type InvestimentoFormData, TIPO_INVESTIMENTO_LABELS } from "@/hooks/useInvestimentos";

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function RentabilidadeBadge({ pct }: { pct: number }) {
  const pos = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${pos ? "text-emerald-400" : "text-red-400"}`}>
      {pos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {pos ? "+" : ""}{pct.toFixed(2)}%
    </span>
  );
}

function InvestimentoFormModal({
  inv,
  onClose,
  onSave,
}: {
  inv?: Investimento | null;
  onClose: () => void;
  onSave: (d: InvestimentoFormData) => Promise<void>;
}) {
  const [nome, setNome] = useState(inv?.nome || "");
  const [descricao, setDescricao] = useState(inv?.descricao || "");
  const [tipo, setTipo] = useState(inv?.tipo || "renda_fixa");
  const [cor, setCor] = useState(inv?.cor || "#059669");
  const [valorInicial, setValorInicial] = useState(inv?.valor_inicial ? String(inv.valor_inicial) : "");
  const [valorAtual, setValorAtual] = useState(inv?.valor_atual ? String(inv.valor_atual) : "");
  const [taxa, setTaxa] = useState(inv?.taxa_juros_anual ? String(inv.taxa_juros_anual) : "");
  const [dataInicio, setDataInicio] = useState(inv?.data_inicio || "");
  const [dataVenc, setDataVenc] = useState(inv?.data_vencimento || "");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const CORES = ["#059669", "#2563EB", "#6D28D9", "#D97706", "#DC2626", "#0891B2", "#84CC16", "#7C3AED"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { setErro("Nome é obrigatório."); return; }
    if (!valorInicial || parseFloat(valorInicial) <= 0) { setErro("Valor inicial inválido."); return; }
    if (!dataInicio) { setErro("Data de início é obrigatória."); return; }
    setLoading(true);
    setErro(null);
    try {
      await onSave({
        nome: nome.trim(),
        descricao,
        tipo,
        cor,
        valor_inicial: parseFloat(valorInicial),
        valor_atual: valorAtual ? parseFloat(valorAtual) : parseFloat(valorInicial),
        taxa_juros_anual: taxa ? parseFloat(taxa) : null,
        data_inicio: dataInicio,
        data_vencimento: dataVenc || null,
      });
      onClose();
    } catch {
      setErro("Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 className="font-semibold text-white">{inv ? "Editar Investimento" : "Novo Investimento"}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Nome *</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Tesouro Direto IPCA+" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Tipo</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none">
                {Object.entries(TIPO_INVESTIMENTO_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">Cor</label>
              <div className="flex gap-1.5 flex-wrap">
                {CORES.map((c) => (
                  <button key={c} type="button" onClick={() => setCor(c)}
                    className={`w-6 h-6 rounded-full border-2 ${cor === c ? "border-white scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Valor investido *</label>
              <input type="number" min="0" step="0.01" value={valorInicial} onChange={(e) => setValorInicial(e.target.value)} placeholder="0,00" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Valor atual</label>
              <input type="number" min="0" step="0.01" value={valorAtual} onChange={(e) => setValorAtual(e.target.value)} placeholder="Igual ao inicial" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Taxa anual (%)</label>
              <input type="number" min="0" step="0.01" value={taxa} onChange={(e) => setTaxa(e.target.value)} placeholder="Ex: 12.5" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Data início *</label>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Vencimento</label>
            <input type="date" value={dataVenc} onChange={(e) => setDataVenc(e.target.value)} className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Descrição</label>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none" />
          </div>
          {erro && <p className="text-xs text-red-400">{erro}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-white/10 rounded-lg py-2 text-sm text-zinc-400 hover:bg-white/5">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-60">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (inv ? "Salvar" : "Criar")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Simular projeção com juros compostos ──────────────────────

function projecao(valorAtual: number, taxaAnual: number, anos: number) {
  return valorAtual * Math.pow(1 + taxaAnual / 100, anos);
}

function ProjecaoSection({ investimentos }: { investimentos: Investimento[] }) {
  const comTaxa = investimentos.filter((i) => i.taxa_juros_anual && i.taxa_juros_anual > 0 && i.ativo);
  if (comTaxa.length === 0) return null;

  const anos = [1, 3, 5, 10];
  const totalAtual = comTaxa.reduce((acc, i) => acc + i.valor_atual, 0);

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-emerald-400" />
        Projeção de Crescimento (Juros Compostos)
      </h3>
      <div className="grid grid-cols-4 gap-3">
        {anos.map((a) => {
          const projetado = comTaxa.reduce((acc, inv) => {
            return acc + projecao(inv.valor_atual, Number(inv.taxa_juros_anual), a);
          }, 0);
          const ganho = projetado - totalAtual;
          return (
            <div key={a} className="bg-white/5 rounded-lg p-3 text-center">
              <p className="text-xs text-zinc-500 mb-1">{a} ano{a > 1 ? "s" : ""}</p>
              <p className="text-sm font-bold text-white">{formatBRL(projetado)}</p>
              <p className="text-xs text-emerald-400 mt-0.5">+{formatBRL(ganho)}</p>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-zinc-500 mt-3">* Projeção baseada nas taxas cadastradas para {comTaxa.length} investimento(s) ativo(s)</p>
    </div>
  );
}

export default function InvestimentosPage() {
  const { investimentos, resumo, loading, carregar, criar, atualizar, deletar } = useInvestimentos();
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Investimento | null>(null);
  const [confirmandoDelete, setConfirmandoDelete] = useState<string | null>(null);

  useEffect(() => { carregar(); }, [carregar]);

  const posTipos = [...new Set(investimentos.map((i) => i.tipo))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-emerald-400" />
            Investimentos
          </h1>
          <p className="text-sm text-gray-400 mt-1">Acompanhe sua carteira de investimentos</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={carregar} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setEditando(null); setShowForm(true); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm text-white font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Investimento
          </button>
        </div>
      </div>

      {/* Resumo KPIs */}
      {resumo && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Investido", value: formatBRL(resumo.total_investido), icon: DollarSign, color: "text-blue-400" },
            { label: "Valor Atual", value: formatBRL(resumo.total_atual), icon: TrendingUp, color: "text-emerald-400" },
            { label: "Ganho Total", value: formatBRL(resumo.ganho_total), icon: resumo.ganho_total >= 0 ? TrendingUp : TrendingDown, color: resumo.ganho_total >= 0 ? "text-emerald-400" : "text-red-400" },
            { label: "Rentabilidade", value: `${resumo.rentabilidade_geral >= 0 ? "+" : ""}${resumo.rentabilidade_geral.toFixed(2)}%`, icon: BarChart3, color: resumo.rentabilidade_geral >= 0 ? "text-emerald-400" : "text-red-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-4 w-4 ${color}`} />
                <p className="text-xs text-zinc-400">{label}</p>
              </div>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Projeção */}
      <ProjecaoSection investimentos={investimentos} />

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
        </div>
      ) : investimentos.length === 0 ? (
        <div className="border-2 border-dashed border-white/10 rounded-xl p-12 text-center">
          <TrendingUp className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400">Nenhum investimento cadastrado</p>
          <button onClick={() => { setEditando(null); setShowForm(true); }} className="mt-3 text-sm text-emerald-400 hover:text-emerald-300">
            + Adicionar primeiro investimento
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {posTipos.map((tipo) => {
            const grupo = investimentos.filter((i) => i.tipo === tipo);
            return (
              <div key={tipo}>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-1">
                  {TIPO_INVESTIMENTO_LABELS[tipo] || tipo}
                </h3>
                <div className="space-y-2">
                  {grupo.map((inv) => (
                    <div key={inv.id} className={`bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4 ${!inv.ativo ? "opacity-60" : ""}`}>
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${inv.cor}20` }}>
                        <TrendingUp className="h-5 w-5" style={{ color: inv.cor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white">{inv.nome}</p>
                          {!inv.ativo && <span className="text-xs text-zinc-500 bg-white/5 px-1.5 py-0.5 rounded">Inativo</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-zinc-500">
                          <span>Desde {new Date(inv.data_inicio).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}</span>
                          {inv.taxa_juros_anual && <span>{Number(inv.taxa_juros_anual).toFixed(2)}% a.a.</span>}
                          {inv.data_vencimento && <span>Venc. {new Date(inv.data_vencimento).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}</span>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-white">{formatBRL(inv.valor_atual)}</p>
                        <RentabilidadeBadge pct={inv.rentabilidade} />
                        <p className="text-xs text-zinc-500 mt-0.5">{inv.ganho_absoluto >= 0 ? "+" : ""}{formatBRL(inv.ganho_absoluto)}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => { setEditando(inv); setShowForm(true); }} className="p-1.5 rounded text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 transition-colors">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setConfirmandoDelete(inv.id)} className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmandoDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl w-full max-w-xs p-6 text-center">
            <Trash2 className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="font-semibold text-white">Excluir investimento?</p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setConfirmandoDelete(null)} className="flex-1 border border-white/10 rounded-lg py-2 text-sm text-zinc-400 hover:bg-white/5">Cancelar</button>
              <button onClick={async () => { await deletar(confirmandoDelete); setConfirmandoDelete(null); }} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2 text-sm font-medium">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <InvestimentoFormModal
          inv={editando}
          onClose={() => { setShowForm(false); setEditando(null); }}
          onSave={async (dados) => {
            if (editando) await atualizar(editando.id, dados);
            else await criar(dados);
          }}
        />
      )}
    </div>
  );
}
