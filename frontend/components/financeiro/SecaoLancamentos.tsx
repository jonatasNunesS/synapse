"use client";
/**
 * Synapse — a seção de lançamentos: a tabela e tudo que se pode fazer nela.
 *
 * Existe porque as duas telas que listam lançamentos (o painel do financeiro
 * e o "ver todos") mantinham cada uma o seu próprio código de exclusão. Elas
 * divergiram: o "ver todos" ganhou o fluxo auditado para lançamentos PAGOS
 * — perfil de admin, motivo obrigatório, registro no histórico — e o painel
 * ficou para trás, sem sequer informar o perfil à tabela. Resultado: a
 * tabela assumia "não é admin" e bloqueava justamente quem tinha direito.
 *
 * Com o comportamento em um lugar só, as duas telas passam a fazer a mesma
 * coisa por construção, e a próxima regra de lançamento entra uma vez.
 *
 * O que muda conforme a tela fica em props: o rodapé (a paginação do "ver
 * todos") e o `onMutacao`, que o painel usa para recarregar o saldo.
 */
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { EditarPagoModal } from "@/components/financeiro/EditarPagoModal";
import { ExcluirPagoModal } from "@/components/financeiro/ExcluirPagoModal";
import { HistoricoLancamentoModal } from "@/components/financeiro/HistoricoLancamentoModal";
import { LancamentoTable } from "@/components/financeiro/LancamentoTable";
import { PagarModal } from "@/components/financeiro/PagarModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/hooks/useAuth";
import { getErrorMessage } from "@/lib/api";
import type {
  Categoria,
  Lancamento,
  LancamentoCreate,
  LancamentoPagar,
} from "@/types/financeiro";

/** As mutações que a seção precisa — vêm do useLancamentos da página. */
export interface AcoesLancamento {
  atualizar: (
    id: string,
    dados: Partial<LancamentoCreate>,
    motivo?: string
  ) => Promise<Lancamento>;
  deletar: (id: string) => Promise<void>;
  excluirAuditado: (id: string, motivo: string) => Promise<void>;
  pagar: (id: string, dados: LancamentoPagar) => Promise<Lancamento>;
}

interface Props {
  lancamentos: Lancamento[];
  loading: boolean;
  categorias: Categoria[];
  acoes: AcoesLancamento;
  /** Roda depois de cada mutação — o painel recarrega o saldo por aqui. */
  onMutacao?: () => void;
  /** Rodapé opcional, dentro da mesma moldura (a paginação do "ver todos"). */
  children?: ReactNode;
}

export function SecaoLancamentos({
  lancamentos,
  loading,
  categorias,
  acoes,
  onMutacao,
  children,
}: Props) {
  const { usuario } = useAuth();
  const isAdmin = usuario?.perfil === "admin";

  const [lancamentoParaPagar, setLancamentoParaPagar] =
    useState<Lancamento | null>(null);
  const [lancamentoParaExcluir, setLancamentoParaExcluir] =
    useState<Lancamento | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  // Fluxo auditado de lançamentos PAGOS (admin + motivo + log)
  const [pagoParaEditar, setPagoParaEditar] = useState<Lancamento | null>(null);
  const [pagoParaExcluir, setPagoParaExcluir] = useState<Lancamento | null>(null);
  const [lancamentoHistorico, setLancamentoHistorico] =
    useState<Lancamento | null>(null);

  const handlePagar = async (dataPagamento: string) => {
    if (!lancamentoParaPagar) return;
    try {
      await acoes.pagar(lancamentoParaPagar.id, { data_pagamento: dataPagamento });
      setLancamentoParaPagar(null);
      onMutacao?.();
    } catch (err) {
      toast.error(getErrorMessage(err), { duration: 7000 });
    }
  };

  /** Pago vai para o fluxo auditado; pendente segue a confirmação simples. */
  const handleExcluirClick = (lancamento: Lancamento) => {
    if (lancamento.status === "pago") {
      setPagoParaExcluir(lancamento);
    } else {
      setLancamentoParaExcluir(lancamento);
    }
  };

  const handleConfirmarExclusao = async () => {
    if (!lancamentoParaExcluir || excluindo) return; // evita duplo clique
    setExcluindo(true);
    try {
      await acoes.deletar(lancamentoParaExcluir.id);
      toast.success("Lançamento excluído.");
      setLancamentoParaExcluir(null);
      onMutacao?.();
    } catch (err) {
      // Erro NUNCA calado: mostra a mensagem real do backend
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setExcluindo(false);
    }
  };

  const handleEditarPago = async (
    dados: Partial<LancamentoCreate>,
    motivo: string
  ) => {
    if (!pagoParaEditar) return;
    try {
      await acoes.atualizar(pagoParaEditar.id, dados, motivo);
      toast.success(
        "Lançamento pago atualizado. A alteração ficou registrada no histórico."
      );
      setPagoParaEditar(null);
      onMutacao?.();
    } catch (err) {
      toast.error(getErrorMessage(err), { duration: 7000 });
    }
  };

  const handleExcluirPago = async (motivo: string) => {
    if (!pagoParaExcluir) return;
    try {
      await acoes.excluirAuditado(pagoParaExcluir.id, motivo);
      toast.success(
        "Lançamento pago excluído. A operação ficou registrada no histórico."
      );
      setPagoParaExcluir(null);
      onMutacao?.();
    } catch (err) {
      toast.error(getErrorMessage(err), { duration: 7000 });
    }
  };

  return (
    <>
      <LancamentoTable
        lancamentos={lancamentos}
        loading={loading}
        isAdmin={isAdmin}
        onPagar={setLancamentoParaPagar}
        onEditar={setPagoParaEditar}
        onDeletar={handleExcluirClick}
        onHistorico={setLancamentoHistorico}
      />

      {children}

      {lancamentoParaPagar && (
        <PagarModal
          lancamento={lancamentoParaPagar}
          onConfirmar={handlePagar}
          onClose={() => setLancamentoParaPagar(null)}
        />
      )}

      <ConfirmDialog
        open={!!lancamentoParaExcluir}
        titulo="Excluir lançamento"
        mensagem={
          <>
            Excluir{" "}
            <span className="text-foreground font-medium">
              {lancamentoParaExcluir?.descricao}
            </span>
            ? Esta ação não pode ser desfeita.
          </>
        }
        confirmLabel="Excluir"
        processando={excluindo}
        onConfirm={handleConfirmarExclusao}
        onCancel={() => setLancamentoParaExcluir(null)}
      />

      {/* Fluxo auditado — lançamentos pagos */}
      {pagoParaEditar && (
        <EditarPagoModal
          lancamento={pagoParaEditar}
          categorias={categorias}
          onSubmit={handleEditarPago}
          onClose={() => setPagoParaEditar(null)}
        />
      )}

      {pagoParaExcluir && (
        <ExcluirPagoModal
          lancamento={pagoParaExcluir}
          onConfirm={handleExcluirPago}
          onClose={() => setPagoParaExcluir(null)}
        />
      )}

      {lancamentoHistorico && (
        <HistoricoLancamentoModal
          lancamento={lancamentoHistorico}
          onClose={() => setLancamentoHistorico(null)}
        />
      )}
    </>
  );
}
