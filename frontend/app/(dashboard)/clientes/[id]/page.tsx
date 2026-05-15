"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { useClienteDetalhe, useInteracoes } from "@/hooks/useClientes";
import { TimelineInteracoes } from "@/components/clientes/TimelineInteracoes";
import { InteracaoForm } from "@/components/clientes/InteracaoForm";
import { ClienteForm } from "@/components/clientes/ClienteForm";
import { STATUS_FUNIL_LABELS, STATUS_FUNIL_COLORS } from "@/types/clientes";
import type { StatusFunil } from "@/types/clientes";
import { api } from "@/lib/api";

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
  const id = params.id as string;

  const { cliente, loading, carregar, setCliente } = useClienteDetalhe(id);
  const { interacoes, loading: interacoesLoading, carregar: carregarInteracoes, registrar } =
    useInteracoes(id);

  const [showInteracaoForm, setShowInteracaoForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [interacaoLoading, setInteracaoLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    carregar();
    carregarInteracoes();
  }, [carregar, carregarInteracoes]);

  const handleRegistrarInteracao = async (dados: Parameters<typeof registrar>[0]) => {
    setInteracaoLoading(true);
    try {
      await registrar(dados);
      setShowInteracaoForm(false);
      carregar(); // Recarrega para atualizar valor_total_compras etc.
    } finally {
      setInteracaoLoading(false);
    }
  };

  const handleEditar = async (dados: Parameters<typeof api.patch>[1]) => {
    setEditLoading(true);
    try {
      const resp = await api.patch(`/clientes/${id}/`, dados);
      if (resp.success && resp.data) {
        setCliente(resp.data as typeof cliente);
        setShowEditForm(false);
      }
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeletar = async () => {
    if (!confirm("Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita."))
      return;
    await api.delete(`/clientes/${id}/`);
    router.push("/clientes");
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
        <Link href="/clientes" className="text-purple-400 hover:text-purple-300 mt-2 inline-block">
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
            onClick={handleDeletar}
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
              <div className="w-12 h-12 rounded-full bg-purple-600/20 flex items-center justify-center text-purple-400 text-xl font-bold">
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
                <div className="flex items-center gap-1.5 text-purple-400 mb-1">
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
          />
        </div>
      </div>

      {/* Modal de interação */}
      {showInteracaoForm && (
        <InteracaoForm
          onSubmit={handleRegistrarInteracao}
          onClose={() => setShowInteracaoForm(false)}
          loading={interacaoLoading}
        />
      )}

      {/* Modal de edição */}
      {showEditForm && (
        <ClienteForm
          cliente={cliente}
          onSubmit={handleEditar}
          onClose={() => setShowEditForm(false)}
          loading={editLoading}
        />
      )}
    </div>
  );
}
