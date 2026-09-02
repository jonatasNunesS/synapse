"use client";
/**
 * Synapse — Vendas (fase 1).
 *
 * A venda como entidade própria: vários itens, cliente opcional, total
 * derivado das linhas. Convive com o registro de venda por interação do
 * cliente — as duas formas coexistem até a migração da fase 2.
 */
import { useCallback, useState } from "react";
import { Plus, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { VendaDetalheModal } from "@/components/vendas/VendaDetalheModal";
import { VendaForm } from "@/components/vendas/VendaForm";
import { VendaPosVendaFlow } from "@/components/vendas/VendaPosVendaFlow";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useVendas } from "@/hooks/useVendas";
import { getErrorMessage } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { Venda, VendaPayload } from "@/types/vendas";

export default function VendasPage() {
  const { vendas, total, loading, error, criar, atualizar, deletar, recarregar } =
    useVendas();

  const [mostrarForm, setMostrarForm] = useState(false);
  const [vendaParaEditar, setVendaParaEditar] = useState<Venda | null>(null);
  const [vendaDetalhe, setVendaDetalhe] = useState<Venda | null>(null);
  const [vendaParaExcluir, setVendaParaExcluir] = useState<Venda | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  // Venda que acabou de ser registrada → as perguntas de estoque e financeiro.
  const [vendaRecemCriada, setVendaRecemCriada] = useState<Venda | null>(null);

  /**
   * Registra a venda e guarda o que o backend devolveu.
   *
   * É esse retorno que dispara as perguntas: ele traz `tem_itens_com_produto`
   * e `tem_lancamento_financeiro`, que decidem o que sequer é perguntado. O
   * erro sobe intacto — quem mostra o motivo é o formulário, que continua
   * aberto com o que a pessoa digitou.
   */
  const criarEPerguntar = async (dados: VendaPayload): Promise<Venda> => {
    const nova = await criar(dados);
    setVendaRecemCriada(nova);
    return nova;
  };

  // Estáveis porque o fluxo as usa dentro de efeitos: uma identidade nova a
  // cada render faria os efeitos rodarem de novo sem que nada tivesse mudado.
  const aoIntegrar = useCallback(() => recarregar(), [recarregar]);
  const fecharPerguntas = useCallback(() => setVendaRecemCriada(null), []);

  const confirmarExclusao = async () => {
    if (!vendaParaExcluir || excluindo) return; // evita duplo clique
    setExcluindo(true);
    try {
      await deletar(vendaParaExcluir.id);
      toast.success("Venda excluída.");
      setVendaParaExcluir(null);
    } catch (err) {
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendas</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {total} venda{total !== 1 ? "s" : ""} registrada{total !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setMostrarForm(true)}
          className="flex items-center gap-2 self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500 sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Nova venda
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-erro/40 bg-erro/10 px-3 py-2 text-sm text-erro">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-border bg-white/[0.03]">
        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            Carregando vendas...
          </p>
        ) : vendas.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Receipt className="mx-auto mb-3 h-8 w-8 text-muted-suave" />
            <p className="text-sm text-muted-foreground">Nenhuma venda registrada ainda.</p>
            <p className="mt-1 text-xs text-muted-suave">
              Registre a primeira para ver o histórico aqui.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-suave">
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Itens</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Situação</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {vendas.map((venda) => (
                  <tr
                    key={venda.id}
                    className="group border-b border-border last:border-0 transition-colors hover:bg-superficie"
                  >
                    <td className="px-4 py-3 text-foreground-suave">
                      {new Date(venda.data_venda + "T00:00:00").toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setVendaDetalhe(venda)}
                        className="text-brand-accent transition-colors hover:underline"
                      >
                        {/* Sem cliente é o caso normal do balcão, não uma falha. */}
                        {venda.cliente_nome ?? "Sem cliente"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {venda.itens.length} item{venda.itens.length !== 1 ? "ns" : ""}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {formatCurrency(venda.total)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          venda.status_pagamento === "pago"
                            ? "rounded-full bg-emerald-400/10 px-2 py-0.5 text-xs text-sucesso"
                            : "rounded-full bg-amber-400/10 px-2 py-0.5 text-xs text-alerta"
                        }
                      >
                        {venda.status_pagamento === "pago" ? "Pago" : "Pendente"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => setVendaParaEditar(venda)}
                          className="rounded px-2 py-1 text-xs text-brand-accent transition-colors hover:bg-brand-400/10"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setVendaParaExcluir(venda)}
                          className="rounded p-1.5 text-erro transition-colors hover:bg-red-400/10"
                          title="Excluir venda"
                          aria-label="Excluir venda"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {mostrarForm && (
        <VendaForm onSubmit={criarEPerguntar} onClose={() => setMostrarForm(false)} />
      )}

      {vendaRecemCriada && (
        <VendaPosVendaFlow
          venda={vendaRecemCriada}
          onAtualizada={aoIntegrar}
          onFim={fecharPerguntas}
        />
      )}

      {vendaParaEditar && (
        <VendaForm
          venda={vendaParaEditar}
          onSubmit={(dados) => atualizar(vendaParaEditar.id, dados)}
          onClose={() => setVendaParaEditar(null)}
        />
      )}

      {vendaDetalhe && (
        <VendaDetalheModal
          venda={vendaDetalhe}
          onClose={() => setVendaDetalhe(null)}
          onAtualizada={(atualizada) => {
            // O modal mostra a venda que o backend devolveu, e a lista relê
            // para os badges acompanharem sem a pessoa precisar recarregar.
            setVendaDetalhe(atualizada);
            recarregar();
          }}
        />
      )}

      <ConfirmDialog
        open={!!vendaParaExcluir}
        titulo="Excluir venda"
        mensagem={
          <>
            Excluir a venda de{" "}
            <span className="font-medium text-foreground">
              {vendaParaExcluir ? formatCurrency(vendaParaExcluir.total) : ""}
            </span>
            ? Esta ação não pode ser desfeita.
          </>
        }
        confirmLabel="Excluir"
        processando={excluindo}
        onConfirm={confirmarExclusao}
        onCancel={() => setVendaParaExcluir(null)}
      />
    </div>
  );
}
