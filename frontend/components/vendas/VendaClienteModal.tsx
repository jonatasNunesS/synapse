"use client";
/**
 * Synapse — de quem foi esta venda.
 *
 * A venda de balcão sai sem cliente, e às vezes se descobre depois quem era:
 * a pessoa volta, vira cadastro, e a compra precisa entrar no histórico dela.
 * Daí este vínculo poder ser posto, trocado e tirado.
 *
 * O que ele mexe é só organização. O lançamento financeiro fica onde está, com
 * o valor e o status que tinha, e o que já foi recebido continua recebido —
 * quem muda de dono é a venda, não o dinheiro que já entrou. O que anda junto
 * é a cobrança do fiado, porque ela ainda não aconteceu.
 *
 * Pôr um cliente numa venda que não tinha é aditivo e vai direto. Trocar e
 * tirar passam por confirmação: as duas somem com a venda do histórico de
 * alguém, e isso merece um segundo de atenção.
 */
import { useState } from "react";
import { toast } from "sonner";
import { UserMinus, X } from "lucide-react";

import { ClienteSelect } from "@/components/clientes/ClienteSelect";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { getErrorMessage } from "@/lib/api";
import { vendaCliente } from "@/hooks/useVendas";
import type { Venda } from "@/types/vendas";

interface Props {
  venda: Venda;
  onClose: () => void;
  /** Recebe a venda como o backend a devolveu. */
  onVinculada: (venda: Venda) => void;
}

export function VendaClienteModal({ venda, onClose, onVinculada }: Props) {
  const atual = venda.cliente_nome;
  const [processando, setProcessando] = useState(false);
  // Escolha aguardando confirmação: um cliente (troca) ou null (desvincular).
  const [confirmando, setConfirmando] = useState<
    { id: string; nome: string } | null | undefined
  >(undefined);

  const aplicar = async (clienteId: string | null, nome: string | null) => {
    if (processando) return;
    setProcessando(true);
    try {
      onVinculada(await vendaCliente.definir(venda.id, clienteId));
      toast.success(
        nome ? `Venda vinculada a ${nome}.` : "Venda desvinculada do cliente."
      );
      onClose();
    } catch (erro) {
      // Erro nunca calado: "cliente não encontrado" é acionável.
      toast.error(getErrorMessage(erro), { duration: 7000 });
      setProcessando(false);
    }
  };

  const escolher = (cliente: { id: string; nome: string }) => {
    // Sem cliente hoje: é só somar, não há nada a perder.
    if (!atual) {
      aplicar(cliente.id, cliente.nome);
      return;
    }
    setConfirmando(cliente);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
        <div
          data-testid="venda-cliente"
          className="my-8 w-full max-w-md rounded-xl border border-border bg-card shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h2 className="text-sm font-semibold text-foreground">
              {atual ? "Trocar o cliente da venda" : "Vincular a um cliente"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 p-5">
            <p className="text-sm text-muted-foreground">
              {atual ? (
                <>
                  Hoje esta venda é de{" "}
                  <span className="font-medium text-foreground">{atual}</span>.
                </>
              ) : (
                "Esta venda saiu sem cliente. Escolha de quem ela foi."
              )}
            </p>

            <ClienteSelect onSelect={escolher} />

            {atual && (
              <button
                type="button"
                onClick={() => setConfirmando(null)}
                disabled={processando}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-foreground-suave transition-colors hover:bg-superficie disabled:opacity-60"
              >
                <UserMinus className="h-3.5 w-3.5" />
                Tirar o cliente desta venda
              </button>
            )}

            <p className="text-xs text-muted-suave">
              {/* A dúvida que a pessoa tem ao clicar, respondida antes. */}
              Muda só de quem é a venda. O que já foi lançado no financeiro e o
              que já foi recebido não mudam.
            </p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmando !== undefined}
        titulo={confirmando ? "Trocar o cliente" : "Tirar o cliente"}
        mensagem={
          confirmando ? (
            <>
              Esta venda passa de{" "}
              <span className="font-medium text-foreground">{atual}</span> para{" "}
              <span className="font-medium text-foreground">{confirmando.nome}</span>,
              e sai do histórico de {atual}.
            </>
          ) : (
            <>
              Esta venda deixa de ser de{" "}
              <span className="font-medium text-foreground">{atual}</span> e volta a
              ser uma venda de balcão, saindo do histórico dele.
            </>
          )
        }
        confirmLabel={confirmando ? "Trocar" : "Tirar"}
        processando={processando}
        onConfirm={() =>
          confirmando
            ? aplicar(confirmando.id, confirmando.nome)
            : aplicar(null, null)
        }
        onCancel={() => setConfirmando(undefined)}
      />
    </>
  );
}
