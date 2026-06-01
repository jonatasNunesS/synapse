"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Mail,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  RefreshCw,
  Send,
  Play,
  Pause,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import api from "@/lib/api";

interface MensagemAutomatica {
  id: string;
  nome: string;
  assunto: string;
  corpo_html: string;
  gatilho: string;
  gatilho_label: string;
  status: "ativa" | "pausada" | "rascunho";
  total_enviados: number;
  ultimo_disparo: string | null;
  criado_em: string;
  logs?: LogEnvio[];
}

interface LogEnvio {
  id: string;
  destinatario_email: string;
  destinatario_nome: string;
  status: "enviado" | "falhou" | "simulado";
  enviado_em: string;
}

const GATILHOS = [
  { value: "aniversario", label: "Aniversário do Cliente" },
  { value: "followup_atrasado", label: "Follow-up Atrasado" },
  { value: "boas_vindas", label: "Boas-vindas (novo cliente)" },
  { value: "inativo_30d", label: "Cliente Inativo 30 dias" },
  { value: "inativo_60d", label: "Cliente Inativo 60 dias" },
  { value: "vencimento_proximo", label: "Vencimento Próximo (7 dias)" },
  { value: "manual", label: "Disparo Manual" },
];

const STATUS_CORES: Record<string, string> = {
  ativa: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  pausada: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  rascunho: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
};

function MensagemFormModal({
  msg,
  onClose,
  onSave,
}: {
  msg?: MensagemAutomatica | null;
  onClose: () => void;
  onSave: (d: Partial<MensagemAutomatica>) => Promise<void>;
}) {
  const [nome, setNome] = useState(msg?.nome || "");
  const [assunto, setAssunto] = useState(msg?.assunto || "");
  const [corpo, setCorpo] = useState(msg?.corpo_html || "");
  const [gatilho, setGatilho] = useState(msg?.gatilho || "manual");
  const [status, setStatus] = useState(msg?.status || "rascunho");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const TEMPLATE_PADRAO = `<h2>Olá, {{nome}}!</h2>
<p>Temos uma mensagem especial para você.</p>
<p>Se tiver dúvidas, responda este e-mail.</p>
<br/>
<p>Atenciosamente,<br/><strong>Equipe Synapse</strong></p>`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !assunto.trim() || !corpo.trim()) {
      setErro("Nome, assunto e corpo são obrigatórios.");
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      await onSave({ nome, assunto, corpo_html: corpo, gatilho, status });
      onClose();
    } catch {
      setErro("Erro ao salvar mensagem.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 className="font-semibold text-white">{msg ? "Editar Mensagem" : "Nova Mensagem Automática"}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1 rounded"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Nome interno *</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Boas-vindas novos clientes" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Gatilho</label>
              <select value={gatilho} onChange={(e) => setGatilho(e.target.value)} className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none">
                {GATILHOS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as MensagemAutomatica["status"])} className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none">
                <option value="rascunho">Rascunho</option>
                <option value="ativa">Ativa</option>
                <option value="pausada">Pausada</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Assunto do e-mail *</label>
            <input value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Assunto do email" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-violet-500/50" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-zinc-400">Corpo (HTML) *</label>
              {!corpo && (
                <button type="button" onClick={() => setCorpo(TEMPLATE_PADRAO)} className="text-xs text-violet-400 hover:text-violet-300">
                  Usar template padrão
                </button>
              )}
            </div>
            <textarea value={corpo} onChange={(e) => setCorpo(e.target.value)} rows={8} placeholder="HTML do email. Use {{nome}} para personalização." className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono outline-none focus:border-violet-500/50" />
            <p className="text-xs text-zinc-500 mt-1">Variáveis disponíveis: <code className="text-violet-400">{`{{nome}}`}</code>, <code className="text-violet-400">{`{{email}}`}</code></p>
          </div>
          {erro && <p className="text-xs text-red-400">{erro}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-white/10 rounded-lg py-2 text-sm text-zinc-400 hover:bg-white/5">Cancelar</button>
            <button type="submit" disabled={loading} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-60">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (msg ? "Salvar" : "Criar Mensagem")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DispararModal({
  msg,
  onClose,
}: {
  msg: MensagemAutomatica;
  onClose: () => void;
}) {
  const [emailsRaw, setEmailsRaw] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<{ enviados: number; falhas: number; modo: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const handleDisparar = async () => {
    const linhas = emailsRaw.split("\n").filter((l) => l.trim());
    const destinatarios = linhas.map((l) => {
      const parts = l.split(",");
      return { email: parts[0]?.trim(), nome: parts[1]?.trim() || "" };
    }).filter((d) => d.email && d.email.includes("@"));

    if (destinatarios.length === 0) {
      setErro("Informe ao menos um email válido.");
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const res = await api.post<{ data: { enviados: number; falhas: number; modo: string } }>(
        `/mensagens/${msg.id}/disparar/`,
        { destinatarios }
      );
      setResultado(res.data?.data || null);
    } catch {
      setErro("Erro ao disparar mensagem.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0f1117] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h3 className="font-semibold text-white">Disparar Mensagem</h3>
            <p className="text-xs text-zinc-400 mt-0.5">{msg.nome}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1 rounded"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {resultado ? (
            <div className="text-center py-4">
              <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
              <p className="font-semibold text-white">Disparo concluído!</p>
              <p className="text-sm text-zinc-400 mt-1">{resultado.enviados} enviados · {resultado.falhas} falhas</p>
              {resultado.modo === "simulado (dev)" && (
                <p className="text-xs text-amber-400 mt-2">Modo simulado (sem RESEND_API_KEY configurado)</p>
              )}
              <button onClick={onClose} className="mt-5 px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm">Fechar</button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Destinatários (um por linha: <code className="text-violet-400">email,Nome</code>)
                </label>
                <textarea
                  value={emailsRaw}
                  onChange={(e) => setEmailsRaw(e.target.value)}
                  rows={6}
                  placeholder={`joao@empresa.com,João Silva\nmaria@empresa.com,Maria`}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-violet-500/50"
                />
              </div>
              {erro && <p className="text-xs text-red-400">{erro}</p>}
              <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 border border-white/10 rounded-lg py-2 text-sm text-zinc-400 hover:bg-white/5">Cancelar</button>
                <button onClick={handleDisparar} disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-60">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Disparar</>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MensagensPage() {
  const [mensagens, setMensagens] = useState<MensagemAutomatica[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<MensagemAutomatica | null>(null);
  const [disparando, setDisparando] = useState<MensagemAutomatica | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: MensagemAutomatica[] }>("/mensagens/");
      setMensagens(res.data?.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const handleSave = async (dados: Partial<MensagemAutomatica>) => {
    if (editando) {
      await api.patch(`/mensagens/${editando.id}/`, dados);
    } else {
      await api.post("/mensagens/", dados);
    }
    await carregar();
  };

  const handleDeletar = async (id: string) => {
    if (!confirm("Excluir mensagem?")) return;
    await api.delete(`/mensagens/${id}/`);
    await carregar();
  };

  const handleToggleStatus = async (msg: MensagemAutomatica) => {
    const novoStatus = msg.status === "ativa" ? "pausada" : "ativa";
    await api.patch(`/mensagens/${msg.id}/`, { status: novoStatus });
    await carregar();
  };

  const ativos = mensagens.filter((m) => m.status === "ativa").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Mail className="h-6 w-6 text-violet-400" />
            Mensagens Automáticas
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {ativos} mensagem{ativos !== 1 ? "ns" : ""} ativa{ativos !== 1 ? "s" : ""} · disparo automático por email
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={carregar} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setEditando(null); setShowForm(true); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg text-sm text-white font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Mensagem
          </button>
        </div>
      </div>

      {/* Gatilhos disponíveis */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Gatilhos Disponíveis</h3>
        <div className="flex flex-wrap gap-2">
          {GATILHOS.map((g) => (
            <span key={g.value} className="text-xs px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
              {g.label}
            </span>
          ))}
        </div>
      </div>

      {/* Lista de mensagens */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
        </div>
      ) : mensagens.length === 0 ? (
        <div className="border-2 border-dashed border-white/10 rounded-xl p-12 text-center">
          <Mail className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400">Nenhuma mensagem automática criada</p>
          <button onClick={() => { setEditando(null); setShowForm(true); }} className="mt-3 text-sm text-violet-400 hover:text-violet-300">
            + Criar primeira mensagem
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {mensagens.map((msg) => (
            <div key={msg.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white">{msg.nome}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_CORES[msg.status]}`}>
                      {msg.status}
                    </span>
                    <span className="text-xs text-zinc-500 bg-white/5 px-2 py-0.5 rounded-full">
                      {msg.gatilho_label}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Assunto: {msg.assunto}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-zinc-600">
                    <span className="flex items-center gap-1">
                      <Send className="h-3 w-3" />
                      {msg.total_enviados} enviados
                    </span>
                    {msg.ultimo_disparo && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Último: {new Date(msg.ultimo_disparo).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setDisparando(msg)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    title="Disparar agora"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Disparar
                  </button>
                  <button
                    onClick={() => handleToggleStatus(msg)}
                    className="p-1.5 rounded text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                    title={msg.status === "ativa" ? "Pausar" : "Ativar"}
                  >
                    {msg.status === "ativa" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                  <button onClick={() => { setEditando(msg); setShowForm(true); }} className="p-1.5 rounded text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10 transition-colors">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDeletar(msg.id)} className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => setExpandido(expandido === msg.id ? null : msg.id)} className="p-1.5 rounded text-zinc-500 hover:text-white hover:bg-white/10 transition-colors">
                    {expandido === msg.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Preview HTML colapsável */}
              {expandido === msg.id && (
                <div className="px-5 pb-4 border-t border-white/5 pt-3">
                  <p className="text-xs font-medium text-zinc-500 mb-2">Preview do corpo HTML:</p>
                  <div
                    className="bg-white rounded-lg p-3 text-sm text-slate-800 max-h-48 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: msg.corpo_html }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Info sobre automações */}
      <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="h-4 w-4 text-violet-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-medium text-violet-300">Sobre disparos automáticos</p>
          <p className="text-xs text-zinc-400 mt-0.5">
            As mensagens com gatilhos automáticos são processadas diariamente pela tarefa Celery.
            Mensagens <strong>Manuais</strong> são disparadas clicando em &quot;Disparar&quot;.
            Configure a variável <code className="text-violet-400">RESEND_API_KEY</code> no backend para envios reais.
          </p>
        </div>
      </div>

      {showForm && (
        <MensagemFormModal
          msg={editando}
          onClose={() => { setShowForm(false); setEditando(null); }}
          onSave={handleSave}
        />
      )}

      {disparando && (
        <DispararModal
          msg={disparando}
          onClose={() => { setDisparando(null); carregar(); }}
        />
      )}
    </div>
  );
}
