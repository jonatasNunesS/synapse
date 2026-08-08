"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  MessageCircle,
  DollarSign,
  ShoppingBag,
  Calendar,
  AlertCircle,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { useClienteDetalhe, useInteracoes } from "@/hooks/useClientes";
import { TimelineInteracoes } from "@/components/clientes/TimelineInteracoes";
import type { FiltroEstoque } from "@/components/clientes/TimelineInteracoes";
import { InteracaoForm } from "@/components/clientes/InteracaoForm";
import { BaixarEstoqueModal } from "@/components/clientes/BaixarEstoqueModal";
import { FiadoDecisaoModal } from "@/components/clientes/FiadoDecisaoModal";
import { RegistrarFinanceiroModal } from "@/components/financeiro/RegistrarFinanceiroModal";
import { ClienteForm } from "@/components/clientes/ClienteForm";
import { ApagarComAjustesFlow } from "@/components/clientes/ApagarComAjustesFlow";
import { FollowupAgendaModal } from "@/components/clientes/FollowupAgendaModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { STATUS_FUNIL_LABELS, STATUS_FUNIL_COLORS } from "@/types/clientes";
import type { StatusFunil, InteracaoCliente } from "@/types/clientes";
import { api, getErrorMessage } from "@/lib/api";
import { useModulos } from "@/hooks/useModulos";

function formatCurrency(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num || 0);
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-gray-500 w-28 flex-shrink-0">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}

export default function ClienteDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  // Chegou pelo sino? (?fiado=<id>) → abre o modal de cobrança da venda fiada.
  const fiadoId = searchParams.get("fiado");
  const [fiadoFechado, setFiadoFechado] = useState<string | null>(null);

  const { cliente, loading, carregar, setCliente } = useClienteDetalhe(id);
  const { moduloAtivo } = useModulos();
  const {
    interacoes,
    loading: interacoesLoading,
    carregar: carregarInteracoes,
    registrar,
    editar,
    apagar,
    registrarFinanceiro,
    apagarComAjustes,
    criarEventoFollowup,
  } = useInteracoes(id);

  const [showInteracaoForm, setShowInteracaoForm] = useState(false);
  const [editingInteracao, setEditingInteracao] = useState<InteracaoCliente | null>(null);
  const [vendaParaEstoque, setVendaParaEstoque] = useState<InteracaoCliente | null>(null);
  // Depois do estoque, oferece registrar receita no financeiro (mesma venda).
  const [vendaParaFinanceiro, setVendaParaFinanceiro] = useState<InteracaoCliente | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [interacaoLoading, setInteracaoLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [interacaoParaExcluir, setInteracaoParaExcluir] =
    useState<InteracaoCliente | null>(null);
  const [excluindoInteracao, setExcluindoInteracao] = useState(false);
  // Fluxo de perguntas de estorno/financeiro ao apagar uma venda com vínculos.
  const [apagarFlow, setApagarFlow] = useState<InteracaoCliente | null>(null);
  const [confirmarExclusaoCliente, setConfirmarExclusaoCliente] = useState(false);
  const [excluindoCliente, setExcluindoCliente] = useState(false);
  // Após salvar com um novo follow-up, oferece criar o evento na Agenda.
  const [followupAgenda, setFollowupAgenda] = useState<string | null>(null);
  // Filtro de controle de estoque (Todos | Descontados | Não descontados).
  const [filtroEstoque, setFiltroEstoque] = useState<FiltroEstoque>("");

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Recarrega as interações sempre que o filtro de estoque muda.
  useEffect(() => {
    carregarInteracoes(filtroEstoque ? { estoque: filtroEstoque } : {});
  }, [carregarInteracoes, filtroEstoque]);

  // Recarrega as interações preservando o filtro de estoque atual.
  const recarregarInteracoes = () =>
    carregarInteracoes(filtroEstoque ? { estoque: filtroEstoque } : {});

  const handleRegistrarInteracao = async (dados: Parameters<typeof registrar>[0]) => {
    setInteracaoLoading(true);
    try {
      const nova = await registrar(dados); // lança em caso de erro → o form exibe o banner
      setShowInteracaoForm(false);
      carregar(); // Recarrega para atualizar valor_total_compras etc.
      // Venda? Oferece baixar do estoque — só se o módulo Estoque estiver
      // ativo; senão vai direto para o financeiro (que é obrigatório).
      if (nova?.tipo === "venda") {
        if (moduloAtivo("estoque")) setVendaParaEstoque(nova);
        else setVendaParaFinanceiro(nova);
      }
    } finally {
      setInteracaoLoading(false);
    }
  };

  const handleEditarInteracao = async (dados: Parameters<typeof registrar>[0]) => {
    if (!editingInteracao) return;
    setInteracaoLoading(true);
    try {
      await editar(editingInteracao.id, dados); // lança → form mostra o erro
      toast.success("Interação atualizada.");
      setEditingInteracao(null);
      carregar(); // agregados (valor_total_compras) podem ter mudado
    } finally {
      // Erro é exibido no banner do próprio form (mantém aberto); não engolimos.
      setInteracaoLoading(false);
    }
  };

  const handleApagarInteracao = (interacao: InteracaoCliente) => {
    setInteracaoParaExcluir(interacao);
  };

  const handleConfirmarExclusaoInteracao = async () => {
    if (!interacaoParaExcluir || excluindoInteracao) return; // evita duplo clique
    const alvo = interacaoParaExcluir;
    // Estoque desligado → não pergunta sobre estorno de estoque (só financeiro).
    const temEstoque = moduloAtivo("estoque") && !!alvo.movimentacao_estoque_info;
    const temVinculo = temEstoque || !!alvo.lancamento_financeiro_info;

    // Tem estoque/financeiro vinculado → sequência de perguntas (estorno etc.).
    if (temVinculo) {
      setInteracaoParaExcluir(null);
      setApagarFlow(alvo);
      return;
    }

    // Sem vínculo: apaga direto.
    setExcluindoInteracao(true);
    try {
      await apagar(alvo.id);
      toast.success("Interação excluída.");
      setInteracaoParaExcluir(null);
      carregar(); // recalcula agregados do cliente
    } catch (err) {
      // Erro NUNCA calado: mostra a mensagem real do backend
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setExcluindoInteracao(false);
    }
  };

  // Executa o apagar com as escolhas de estorno/financeiro coletadas no fluxo.
  const finalizarApagarComAjustes = async (
    estornarEstoque: boolean,
    apagarFinanceiro: boolean
  ) => {
    if (!apagarFlow || excluindoInteracao) return;
    setExcluindoInteracao(true);
    try {
      await apagarComAjustes(apagarFlow.id, {
        estornar_estoque: estornarEstoque,
        apagar_financeiro: apagarFinanceiro,
      });
      toast.success("Interação apagada.");
      setApagarFlow(null);
      carregar();
    } catch (err) {
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setExcluindoInteracao(false);
    }
  };

  const handleEditar = async (dados: Parameters<typeof api.patch>[1]) => {
    setEditLoading(true);
    // Follow-up definido/alterado? Guarda para oferecer o evento na Agenda.
    const followupAntes = cliente?.proximo_followup ?? null;
    try {
      const resp = await api.patch(`/clientes/${id}/`, dados);
      if (resp.success && resp.data) {
        const atualizado = resp.data as typeof cliente;
        setCliente(atualizado);
        setShowEditForm(false);
        const followupDepois = atualizado?.proximo_followup ?? null;
        // Só oferece a Agenda se o módulo estiver ativo.
        if (
          followupDepois &&
          followupDepois !== followupAntes &&
          moduloAtivo("agenda")
        ) {
          setFollowupAgenda(followupDepois);
        }
      }
    } finally {
      setEditLoading(false);
    }
  };

  const handleConfirmarExclusaoCliente = async () => {
    if (excluindoCliente) return; // evita duplo clique
    setExcluindoCliente(true);
    try {
      await api.delete(`/clientes/${id}/`);
      toast.success("Cliente excluído.");
      router.push("/clientes");
    } catch (err) {
      // Erro NUNCA calado: mostra a mensagem real do backend
      toast.error(getErrorMessage(err), { duration: 7000 });
      setExcluindoCliente(false);
    }
  };

  if (loading && !cliente) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-white/5 rounded w-48" />
        <div className="h-48 bg-white/5 rounded-xl" />
        <div className="h-64 bg-white/5 rounded-xl" />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Cliente não encontrado.</p>
        <Link href="/clientes" className="text-brand-400 hover:text-brand-300 mt-2 inline-block">
          Voltar para Clientes
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Ações */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/clientes"
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">{cliente.nome}</h1>
            <p className="text-xs text-gray-500">{cliente.tipo_display}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {cliente.link_whatsapp && (
            <a
              href={cliente.link_whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-600/30 rounded-lg text-xs text-green-400 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp
            </a>
          )}
          <button
            onClick={() => setShowEditForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-300 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Editar
          </button>
          <button
            onClick={() => setConfirmarExclusaoCliente(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-600/10 hover:bg-red-600/20 border border-red-600/20 rounded-lg text-xs text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Excluir
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna esquerda: Perfil */}
        <div className="lg:col-span-1 space-y-4">
          {/* Card de perfil */}
          <div className="bg-[#0f1117] border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 text-xl font-bold">
                {cliente.nome.charAt(0).toUpperCase()}
              </div>
              <div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white ${
                    STATUS_FUNIL_COLORS[cliente.status_funil as StatusFunil]
                  }`}
                >
                  {STATUS_FUNIL_LABELS[cliente.status_funil as StatusFunil]}
                </span>
                <p className="text-xs text-gray-500 mt-0.5">{cliente.origem_display}</p>
              </div>
            </div>

            <div className="space-y-2">
              {cliente.email && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{cliente.email}</span>
                </div>
              )}
              {cliente.telefone && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{cliente.telefone}</span>
                </div>
              )}
              {(cliente.cidade || cliente.estado) && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    {[cliente.cidade, cliente.estado].filter(Boolean).join(", ")}
                  </span>
                </div>
              )}
            </div>

            {cliente.observacoes && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-xs text-gray-500 mb-1">Observações</p>
                <p className="text-sm text-gray-300 leading-relaxed">{cliente.observacoes}</p>
              </div>
            )}
          </div>

          {/* KPIs de compras */}
          <div className="bg-[#0f1117] border border-white/10 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white">Histórico de Compras</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/3 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-green-400 mb-1">
                  <DollarSign className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Total</span>
                </div>
                <p className="text-lg font-bold text-white">
                  {formatCurrency(cliente.valor_total_compras)}
                </p>
              </div>
              <div className="bg-white/3 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-blue-400 mb-1">
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Compras</span>
                </div>
                <p className="text-lg font-bold text-white">{cliente.quantidade_compras}</p>
              </div>
              <div className="bg-white/3 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-brand-400 mb-1">
                  <DollarSign className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Ticket Médio</span>
                </div>
                <p className="text-sm font-bold text-white">
                  {formatCurrency(cliente.ticket_medio)}
                </p>
              </div>
              <div className="bg-white/3 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-yellow-400 mb-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Sem Comprar</span>
                </div>
                <p className="text-sm font-bold text-white">
                  {cliente.dias_sem_compra !== null ? `${cliente.dias_sem_compra}d` : "—"}
                </p>
              </div>
            </div>

            {/* Split recebido / a receber */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                <span className="text-xs font-medium text-emerald-400">Recebido</span>
                <p className="text-sm font-bold text-white mt-0.5">
                  {formatCurrency(cliente.valor_recebido)}
                </p>
              </div>
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                <span className="text-xs font-medium text-amber-400">A receber</span>
                <p className="text-sm font-bold text-white mt-0.5">
                  {formatCurrency(cliente.valor_a_receber)}
                </p>
              </div>
            </div>

            {cliente.ultima_compra && (
              <p className="text-xs text-gray-500">
                Última compra:{" "}
                {new Date(cliente.ultima_compra).toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>

          {/* Follow-up */}
          {(cliente.proximo_followup || cliente.followup_atrasado) && (
            <div
              className={`border rounded-xl p-4 ${
                cliente.followup_atrasado
                  ? "bg-red-500/10 border-red-500/30"
                  : "bg-yellow-500/10 border-yellow-500/30"
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertCircle
                  className={`w-4 h-4 ${
                    cliente.followup_atrasado ? "text-red-400" : "text-yellow-400"
                  }`}
                />
                <span
                  className={`text-sm font-medium ${
                    cliente.followup_atrasado ? "text-red-400" : "text-yellow-400"
                  }`}
                >
                  {cliente.followup_atrasado ? "Follow-up Atrasado" : "Próximo Follow-up"}
                </span>
              </div>
              {cliente.proximo_followup && (
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(cliente.proximo_followup).toLocaleDateString("pt-BR")}
                </p>
              )}
            </div>
          )}

          {/* Info adicional */}
          <div className="bg-[#0f1117] border border-white/10 rounded-xl p-5 space-y-2">
            <h3 className="text-sm font-semibold text-white mb-3">Informações</h3>
            <InfoRow label="CPF / CNPJ" value={cliente.cpf_cnpj} />
            <InfoRow label="Endereço" value={cliente.endereco} />
            <InfoRow label="CEP" value={cliente.cep} />
            <InfoRow
              label="Cadastrado em"
              value={new Date(cliente.criado_em).toLocaleDateString("pt-BR")}
            />
            <InfoRow label="Cadastrado por" value={cliente.criado_por_nome} />
          </div>
        </div>

        {/* Coluna direita: Timeline de interações */}
        <div className="lg:col-span-2">
          <TimelineInteracoes
            interacoes={interacoes}
            loading={interacoesLoading}
            onNovaInteracao={() => setShowInteracaoForm(true)}
            onEditar={(interacao) => setEditingInteracao(interacao)}
            onApagar={handleApagarInteracao}
            onDescontarEstoque={
              moduloAtivo("estoque")
                ? (interacao) => setVendaParaEstoque(interacao)
                : undefined
            }
            filtroEstoque={filtroEstoque}
            onFiltroEstoqueChange={setFiltroEstoque}
          />
        </div>
      </div>

      {/* Modal de nova interação */}
      {showInteracaoForm && (
        <InteracaoForm
          onSubmit={handleRegistrarInteracao}
          onClose={() => setShowInteracaoForm(false)}
          loading={interacaoLoading}
        />
      )}

      {/* Modal de edição de interação */}
      {editingInteracao && (
        <InteracaoForm
          interacao={editingInteracao}
          onSubmit={handleEditarInteracao}
          onClose={() => setEditingInteracao(null)}
          loading={interacaoLoading}
        />
      )}

      {/* Venda registrada → oferece baixar do estoque */}
      {vendaParaEstoque && cliente && (
        <BaixarEstoqueModal
          clienteId={id}
          clienteNome={cliente.nome}
          interacao={vendaParaEstoque}
          onClose={() => {
            // Ao fechar o estoque (sim ou não), oferece o financeiro.
            setVendaParaFinanceiro(vendaParaEstoque);
            setVendaParaEstoque(null);
          }}
          onSuccess={() => {
            carregar();
            recarregarInteracoes(); // reflete o badge "Estoque descontado"
          }}
        />
      )}

      {/* Venda → oferece registrar receita no financeiro */}
      {vendaParaFinanceiro && cliente && (
        <RegistrarFinanceiroModal
          tipo="receita"
          valor={vendaParaFinanceiro.valor ?? "0"}
          contraparteLabel="Cliente"
          contraparteNome={cliente.nome}
          jaRegistrado={vendaParaFinanceiro.ja_no_financeiro}
          registrar={() => registrarFinanceiro(vendaParaFinanceiro.id)}
          onClose={() => setVendaParaFinanceiro(null)}
          onSuccess={() => {
            carregar();
            recarregarInteracoes();
          }}
        />
      )}

      {/* Fiado: cobrança pelo sino (?fiado=<id>) */}
      {(() => {
        if (!cliente || !fiadoId || fiadoId === fiadoFechado) return null;
        const fiadoInteracao = interacoes.find((i) => i.id === fiadoId);
        if (!fiadoInteracao) return null;
        const fechar = () => {
          setFiadoFechado(fiadoId);
          router.replace(`/clientes/${id}`);
        };
        return (
          <FiadoDecisaoModal
            clienteId={id}
            clienteNome={cliente.nome}
            interacao={fiadoInteracao}
            onClose={fechar}
            onResolved={() => {
              carregar();
              recarregarInteracoes();
            }}
          />
        );
      })()}

      {/* Modal de edição */}
      {showEditForm && (
        <ClienteForm
          cliente={cliente}
          onSubmit={handleEditar}
          onClose={() => setShowEditForm(false)}
          loading={editLoading}
        />
      )}

      {/* Apagar venda com vínculos → perguntas de estorno/financeiro */}
      {apagarFlow && (
        <ApagarComAjustesFlow
          tipoFinanceiro="receita"
          movimentacaoInfo={
            moduloAtivo("estoque") ? apagarFlow.movimentacao_estoque_info : null
          }
          lancamentoInfo={apagarFlow.lancamento_financeiro_info}
          processando={excluindoInteracao}
          onFinalizar={finalizarApagarComAjustes}
        />
      )}

      {/* Follow-up salvo → oferece criar o evento na Agenda */}
      {followupAgenda && cliente && (
        <FollowupAgendaModal
          clienteNome={cliente.nome}
          dataFollowup={followupAgenda}
          criarEvento={(atualizar) => criarEventoFollowup(id, atualizar)}
          onClose={() => setFollowupAgenda(null)}
        />
      )}

      {/* Confirmação — excluir interação */}
      <ConfirmDialog
        open={!!interacaoParaExcluir}
        titulo="Excluir interação"
        mensagem={
          <>
            Excluir a interação{" "}
            <span className="text-white font-medium">
              {interacaoParaExcluir?.titulo}
            </span>
            ? Esta ação não pode ser desfeita.
          </>
        }
        confirmLabel="Excluir"
        processando={excluindoInteracao}
        onConfirm={handleConfirmarExclusaoInteracao}
        onCancel={() => setInteracaoParaExcluir(null)}
      />

      {/* Confirmação — excluir cliente */}
      <ConfirmDialog
        open={confirmarExclusaoCliente}
        titulo="Excluir cliente"
        mensagem={
          <>
            Excluir o cliente{" "}
            <span className="text-white font-medium">{cliente?.nome}</span>? Esta
            ação não pode ser desfeita.
          </>
        }
        confirmLabel="Excluir"
        processando={excluindoCliente}
        onConfirm={handleConfirmarExclusaoCliente}
        onCancel={() => setConfirmarExclusaoCliente(false)}
      />
    </div>
  );
}
