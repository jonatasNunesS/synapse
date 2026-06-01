"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, X, Loader2, PiggyBank, Target, Calendar } from "lucide-react";
import { useCaixinhas, type Caixinha, type CaixinhaFormData } from "@/hooks/useCaixinhas";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function CaixinhaCard({
  caixinha,
  onMovimentar,
  onEditar,
  onDeletar,
}: {
  caixinha: Caixinha;
  onMovimentar: (c: Caixinha, tipo: "deposito" | "retirada") => void;
  onEditar: (c: Caixinha) => void;
  onDeletar: (id: string) => void;
}) {
  const progresso = caixinha.progresso;
  const temMeta = caixinha.meta !== null && caixinha.meta !== undefined;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${caixinha.cor}20` }}
          >
            <PiggyBank className="h-5 w-5" style={{ color: caixinha.cor }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{caixinha.nome}</p>
            {caixinha.descricao && (
              <p className="text-xs text-slate-500 truncate max-w-[140px]">{caixinha.descricao}</p>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => onEditar(caixinha)} className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onDeletar(caixinha.id)} className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mb-3">
        <p className="text-xl font-bold text-slate-800">{formatBRL(Number(caixinha.saldo_atual))}</p>
        {temMeta && (
          <p className="text-xs text-slate-400">
            Meta: {formatBRL(Number(caixinha.meta))}
          </p>
        )}
      </div>

      {temMeta && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1">
              <Target className="h-3 w-3 text-slate-400" />
              <span className="text-xs text-slate-500">{progresso.toFixed(0)}%</span>
            </div>
            {caixinha.data_meta && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3 text-slate-400" />
                <span className="text-xs text-slate-400">
                  {new Date(caixinha.data_meta).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
                </span>
              </div>
            )}
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(progresso, 100)}%`,
                backgroundColor: progresso >= 100 ? "#10b981" : caixinha.cor,
              }}
            />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => onMovimentar(caixinha, "deposito")}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Depositar
        </button>
        <button
          onClick={() => onMovimentar(caixinha, "retirada")}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
        >
          <TrendingDown className="h-3.5 w-3.5" />
          Retirar
        </button>
      </div>
    </div>
  );
}

function CaixinhaFormModal({
  caixinha,
  onClose,
  onSave,
}: {
  caixinha?: Caixinha | null;
  onClose: () => void;
  onSave: (dados: CaixinhaFormData) => Promise<void>;
}) {
  const [nome, setNome] = useState(caixinha?.nome || "");
  const [descricao, setDescricao] = useState(caixinha?.descricao || "");
  const [cor, setCor] = useState(caixinha?.cor || "#6D28D9");
  const [meta, setMeta] = useState(caixinha?.meta ? String(caixinha.meta) : "");
  const [dataMeta, setDataMeta] = useState(caixinha?.data_meta || "");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const CORES = ["#6D28D9", "#2563EB", "#059669", "#D97706", "#DC2626", "#7C3AED", "#0891B2", "#84CC16"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { setErro("Nome é obrigatório."); return; }
    setLoading(true);
    setErro(null);
    try {
      await onSave({
        nome: nome.trim(),
        descricao,
        cor,
        meta: meta ? parseFloat(meta) : null,
        data_meta: dataMeta || null,
      });
      onClose();
    } catch {
      setErro("Erro ao salvar caixinha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-slate-800">{caixinha ? "Editar Caixinha" : "Nova Caixinha"}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nome *</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Férias, Reserva de emergência..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Descrição</label>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Opcional"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {CORES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${cor === c ? "border-slate-800 scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Meta (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={meta}
                onChange={(e) => setMeta(e.target.value)}
                placeholder="Opcional"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Data da meta</label>
              <input
                type="date"
                value={dataMeta}
                onChange={(e) => setDataMeta(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-400"
              />
            </div>
          </div>
          {erro && <p className="text-xs text-red-500">{erro}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 rounded-lg py-2 text-sm text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-60">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (caixinha ? "Salvar" : "Criar Caixinha")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MovimentarModal({
  caixinha,
  tipo,
  onClose,
  onConfirm,
}: {
  caixinha: Caixinha;
  tipo: "deposito" | "retirada";
  onClose: () => void;
  onConfirm: (valor: number, descricao: string) => Promise<void>;
}) {
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(valor);
    if (!v || v <= 0) { setErro("Informe um valor válido."); return; }
    setLoading(true);
    setErro(null);
    try {
      await onConfirm(v, descricao);
      onClose();
    } catch {
      setErro("Erro ao realizar movimentação.");
    } finally {
      setLoading(false);
    }
  };

  const isDeposito = tipo === "deposito";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-slate-800">
            {isDeposito ? "Depositar em" : "Retirar de"} &ldquo;{caixinha.nome}&rdquo;
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-slate-500">
            Saldo atual: <span className="font-semibold text-slate-800">{formatBRL(Number(caixinha.saldo_atual))}</span>
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Valor (R$) *</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              autoFocus
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Descrição</label>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Opcional"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-400"
            />
          </div>
          {erro && <p className="text-xs text-red-500">{erro}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 rounded-lg py-2 text-sm text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-60 ${
                isDeposito ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-500 hover:bg-red-600"
              }`}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (isDeposito ? "Depositar" : "Retirar")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CaixinhasSection() {
  const { caixinhas, loading, carregar, criar, atualizar, deletar, movimentar } = useCaixinhas();
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Caixinha | null>(null);
  const [movimentando, setMovimentando] = useState<{ caixinha: Caixinha; tipo: "deposito" | "retirada" } | null>(null);
  const [confirmandoDelete, setConfirmandoDelete] = useState<string | null>(null);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const totalSaldo = caixinhas.reduce((acc, c) => acc + Number(c.saldo_atual), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <PiggyBank className="h-4 w-4 text-purple-500" />
            Caixinhas
          </h3>
          {caixinhas.length > 0 && (
            <p className="text-xs text-slate-400 mt-0.5">
              Total: <span className="font-semibold text-slate-700">{formatBRL(totalSaldo)}</span>
            </p>
          )}
        </div>
        <button
          onClick={() => { setEditando(null); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Nova Caixinha
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
        </div>
      )}

      {!loading && caixinhas.length === 0 && (
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
          <PiggyBank className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Nenhuma caixinha criada ainda</p>
          <p className="text-xs text-slate-300 mt-1">Crie cofrinhos para suas metas financeiras</p>
        </div>
      )}

      {!loading && caixinhas.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {caixinhas.map((c) => (
            <CaixinhaCard
              key={c.id}
              caixinha={c}
              onMovimentar={(caixinha, tipo) => setMovimentando({ caixinha, tipo })}
              onEditar={(caixinha) => { setEditando(caixinha); setShowForm(true); }}
              onDeletar={(id) => setConfirmandoDelete(id)}
            />
          ))}
        </div>
      )}

      {confirmandoDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 text-center">
            <Trash2 className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="font-semibold text-slate-800">Excluir caixinha?</p>
            <p className="text-xs text-slate-500 mt-1">Esta ação não pode ser desfeita. Todo o histórico será removido.</p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setConfirmandoDelete(null)} className="flex-1 border border-slate-200 rounded-lg py-2 text-sm text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={async () => { await deletar(confirmandoDelete); setConfirmandoDelete(null); }}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2 text-sm font-medium"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <CaixinhaFormModal
          caixinha={editando}
          onClose={() => { setShowForm(false); setEditando(null); }}
          onSave={async (dados) => {
            if (editando) {
              await atualizar(editando.id, dados);
            } else {
              await criar(dados);
            }
          }}
        />
      )}

      {movimentando && (
        <MovimentarModal
          caixinha={movimentando.caixinha}
          tipo={movimentando.tipo}
          onClose={() => setMovimentando(null)}
          onConfirm={async (valor, descricao) => {
            await movimentar(movimentando.caixinha.id, movimentando.tipo, valor, descricao);
          }}
        />
      )}
    </div>
  );
}
