"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  FileText,
  Star,
  Pencil,
  Trash2,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { useFornecedorDetail } from "@/hooks/useFornecedores";
import { ScoreSynapseCard } from "@/components/fornecedores/ScoreSynapse";
import { AvaliacaoTripla } from "@/components/fornecedores/AvaliacaoStars";
import { AvaliacaoModal } from "@/components/fornecedores/AvaliacaoModal";
import { HistoricoCompras } from "@/components/fornecedores/HistoricoCompras";
import { FornecedorForm } from "@/components/fornecedores/FornecedorForm";
import type { FornecedorDetail } from "@/types/fornecedores";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ativo: { label: "Ativo", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  inativo: { label: "Inativo", color: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
  suspenso: { label: "Suspenso", color: "bg-red-500/15 text-red-400 border-red-500/30" },
  em_avaliacao: { label: "Em Avaliação", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
};

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-zinc-500">{icon}</div>
      <div>
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="text-sm text-white">{value}</p>
      </div>
    </div>
  );
}

function formatCurrency(value: string | number) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
}

export default function FornecedorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data, loading, error, fetch, remover } = useFornecedorDetail();
  const [showEdit, setShowEdit] = useState(false);
  const [showAvaliacao, setShowAvaliacao] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [localData, setLocalData] = useState<FornecedorDetail | null>(null);

  useEffect(() => {
    fetch(id);
  }, [fetch, id]);

  useEffect(() => {
    if (data) setLocalData(data);
  }, [data]);

  const handleDelete = async () => {
    if (!confirm(`Deseja remover o fornecedor "${localData?.nome}"? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    try {
      await remover(id);
      router.push("/fornecedores");
    } catch {
      setDeleting(false);
      alert("Erro ao remover fornecedor.");
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-2 text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando fornecedor...
        </div>
      </div>
    );
  }

  if (error || !localData) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <p className="text-red-400">{error ?? "Fornecedor não encontrado."}</p>
        <Link href="/fornecedores" className="text-sm text-violet-400 hover:text-violet-300">
          Voltar para Fornecedores
        </Link>
      </div>
    );
  }

  const statusCfg = STATUS_LABELS[localData.status] ?? { label: localData.status, color: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" };

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb + Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/fornecedores"
            className="flex items-center gap-1.5 text-sm text-zinc-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Fornecedores
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="text-sm text-white">{localData.nome}</span>
        </div>
        <div className="flex items-center gap-2">
          {localData.link_whatsapp && (
            <a
              href={localData.link_whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-400 transition-colors hover:bg-emerald-500/20"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
          )}
          <button
            onClick={() => setShowAvaliacao(true)}
            className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-400 transition-colors hover:bg-amber-500/20"
          >
            <Star className="h-4 w-4" />
            Avaliar
          </button>
          <button
            onClick={() => setShowEdit(true)}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-white/10"
          >
            <Pencil className="h-4 w-4" />
            Editar
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-60"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Remover
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Left column: info + score */}
        <div className="space-y-5">
          {/* Header card */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10">
                  <Building2 className="h-6 w-6 text-violet-400" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">{localData.nome}</h1>
                  {localData.categoria_nome && (
                    <p className="text-sm text-zinc-400">{localData.categoria_nome}</p>
                  )}
                </div>
              </div>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
            </div>

            {/* Stats */}
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
              <div className="text-center">
                <p className="text-lg font-bold text-white">
                  {formatCurrency(localData.valor_total_compras)}
                </p>
                <p className="text-xs text-zinc-500">Total Gasto</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-white">{localData.quantidade_pedidos}</p>
                <p className="text-xs text-zinc-500">Pedidos</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-white">
                  {localData.prazo_entrega_dias ? `${localData.prazo_entrega_dias}d` : "—"}
                </p>
                <p className="text-xs text-zinc-500">Prazo</p>
              </div>
            </div>
          </div>

          {/* Score Synapse */}
          <ScoreSynapseCard score={localData.score_synapse} />

          {/* Avaliações */}
          {(localData.avaliacao_qualidade !== null ||
            localData.avaliacao_prazo !== null ||
            localData.avaliacao_preco !== null) && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <h3 className="mb-3 text-sm font-semibold text-white">Avaliações</h3>
              <AvaliacaoTripla
                qualidade={localData.avaliacao_qualidade}
                prazo={localData.avaliacao_prazo}
                preco={localData.avaliacao_preco}
                readonly
                size="md"
              />
            </div>
          )}

          {/* Contato */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h3 className="mb-3 text-sm font-semibold text-white">Contato</h3>
            <div className="space-y-3">
              <InfoRow icon={<Mail className="h-4 w-4" />} label="E-mail" value={localData.email} />
              <InfoRow icon={<Phone className="h-4 w-4" />} label="Telefone" value={localData.telefone} />
              <InfoRow icon={<MessageCircle className="h-4 w-4" />} label="WhatsApp" value={localData.whatsapp} />
              <InfoRow icon={<Globe className="h-4 w-4" />} label="Site" value={localData.site} />
              {(localData.endereco_cidade || localData.endereco_estado) && (
                <InfoRow
                  icon={<MapPin className="h-4 w-4" />}
                  label="Localização"
                  value={[localData.endereco_cidade, localData.endereco_estado].filter(Boolean).join(", ")}
                />
              )}
            </div>
          </div>

          {/* Dados comerciais */}
          {(localData.cnpj || localData.condicoes_pagamento) && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <h3 className="mb-3 text-sm font-semibold text-white">Dados Comerciais</h3>
              <div className="space-y-3">
                <InfoRow icon={<FileText className="h-4 w-4" />} label="CNPJ" value={localData.cnpj} />
                <InfoRow icon={<FileText className="h-4 w-4" />} label="Condições de Pagamento" value={localData.condicoes_pagamento} />
              </div>
            </div>
          )}

          {/* Notas */}
          {localData.notas && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <h3 className="mb-2 text-sm font-semibold text-white">Notas</h3>
              <p className="text-sm text-zinc-400 whitespace-pre-wrap">{localData.notas}</p>
            </div>
          )}
        </div>

        {/* Right column: histórico de compras */}
        <div className="xl:col-span-2">
          <HistoricoCompras fornecedorId={id} />
        </div>
      </div>

      {/* Modals */}
      {showEdit && (
        <FornecedorForm
          fornecedor={localData}
          onSuccess={(updated) => {
            setLocalData(updated);
            setShowEdit(false);
          }}
          onClose={() => setShowEdit(false)}
        />
      )}
      {showAvaliacao && (
        <AvaliacaoModal
          fornecedor={localData}
          onSuccess={(updated) => {
            setLocalData(updated);
            setShowAvaliacao(false);
          }}
          onClose={() => setShowAvaliacao(false)}
        />
      )}
    </div>
  );
}
