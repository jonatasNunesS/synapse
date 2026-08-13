"use client";
/**
 * Atalho para registrar uma interação sem abrir o cliente. Usado na lista de
 * clientes tanto por cliente (card/linha) quanto no botão global do header.
 *
 * Reaproveita o MESMO motor da página do cliente: se a interação for uma venda,
 * dispara BaixarEstoqueModal → RegistrarFinanceiroModal (os mesmos componentes),
 * sem duplicar lógica.
 */
import { useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { useInteracoes } from "@/hooks/useClientes";
import { InteracaoForm } from "@/components/clientes/InteracaoForm";
import { ClienteSelect } from "@/components/clientes/ClienteSelect";
import { BaixarEstoqueModal } from "@/components/clientes/BaixarEstoqueModal";
import { RegistrarFinanceiroModal } from "@/components/financeiro/RegistrarFinanceiroModal";
import type { InteracaoCliente } from "@/types/clientes";
import { useModulos } from "@/hooks/useModulos";

interface Props {
  clienteInicial?: { id: string; nome: string } | null;
  onClose: () => void;
  onCriada?: () => void;
}

export function NovaInteracaoRapidaModal({ clienteInicial, onClose, onCriada }: Props) {
  const { moduloAtivo } = useModulos();
  const [cliente, setCliente] = useState(clienteInicial ?? null);
  const [salvando, setSalvando] = useState(false);
  // Chain do pós-venda (reaproveita o motor)
  const [vendaParaEstoque, setVendaParaEstoque] = useState<InteracaoCliente | null>(null);
  const [vendaParaFinanceiro, setVendaParaFinanceiro] = useState<InteracaoCliente | null>(null);

  const { registrar, registrarFinanceiro } = useInteracoes(cliente?.id ?? "");

  const handleSubmit = async (dados: Parameters<typeof registrar>[0]) => {
    if (!cliente) return;
    setSalvando(true);
    try {
      const nova = await registrar(dados); // lança → o form mostra o banner
      toast.success(`Interação registrada para ${cliente.nome}`);
      onCriada?.();
      if (nova?.tipo === "venda") {
        // Dispara o mesmo fluxo de perguntas (estoque → financeiro). Com o
        // módulo Estoque desligado, pula direto para o financeiro.
        if (moduloAtivo("estoque")) setVendaParaEstoque(nova);
        else setVendaParaFinanceiro(nova);
      } else {
        onClose();
      }
    } finally {
      setSalvando(false);
    }
  };

  // Enquanto o pós-venda roda, mostramos apenas os modais do motor
  if (vendaParaFinanceiro && cliente) {
    return (
      <RegistrarFinanceiroModal
        tipo="receita"
        valor={vendaParaFinanceiro.valor ?? "0"}
        contraparteLabel="Cliente"
        contraparteNome={cliente.nome}
        jaRegistrado={vendaParaFinanceiro.ja_no_financeiro}
        registrar={() => registrarFinanceiro(vendaParaFinanceiro.id)}
        onClose={() => {
          setVendaParaFinanceiro(null);
          onClose();
        }}
        onSuccess={() => onCriada?.()}
      />
    );
  }

  if (vendaParaEstoque && cliente) {
    return (
      <BaixarEstoqueModal
        clienteId={cliente.id}
        clienteNome={cliente.nome}
        interacao={vendaParaEstoque}
        onClose={() => {
          setVendaParaFinanceiro(vendaParaEstoque);
          setVendaParaEstoque(null);
        }}
        onSuccess={() => onCriada?.()}
      />
    );
  }

  // Passo 1 (só no botão global): escolher o cliente
  if (!cliente) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h3 className="text-base font-semibold text-foreground">Nova interação</h3>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-superficie-forte hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="p-5">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Para qual cliente?
            </label>
            <ClienteSelect onSelect={setCliente} />
          </div>
        </div>
      </div>
    );
  }

  // Passo 2: o formulário de interação (cliente já definido)
  return (
    <InteracaoForm
      onSubmit={handleSubmit}
      onClose={onClose}
      loading={salvando}
    />
  );
}
