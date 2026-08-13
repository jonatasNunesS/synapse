"use client";
/**
 * Part 3 — Follow-up → Agenda.
 * Depois de salvar o cliente com um proximo_followup, oferece criar um evento
 * na Agenda para esse dia. Se já existir um evento de follow-up na mesma data,
 * pergunta se quer atualizar (não duplica). Ao criar/atualizar, mostra um toast
 * com atalho "Ver na Agenda".
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { getErrorMessage } from "@/lib/api";
import type { ApiError } from "@/types/api";

interface Props {
  clienteNome: string;
  /** Data do follow-up (ISO yyyy-mm-dd ou datetime). */
  dataFollowup: string;
  /** Cria/atualiza o evento; recebe `atualizar` e devolve a resposta da API. */
  criarEvento: (atualizar: boolean) => Promise<unknown>;
  onClose: () => void;
}

function formatData(iso: string): string {
  // Aceita "yyyy-mm-dd" (sem timezone) sem escorregar um dia.
  const d = iso.length <= 10 ? new Date(`${iso}T00:00:00`) : new Date(iso);
  return d.toLocaleDateString("pt-BR");
}

export function FollowupAgendaModal({
  clienteNome,
  dataFollowup,
  criarEvento,
  onClose,
}: Props) {
  const router = useRouter();
  const [etapa, setEtapa] = useState<"perguntar" | "atualizar">("perguntar");
  const [processando, setProcessando] = useState(false);
  const dataFmt = formatData(dataFollowup);

  const sucesso = (criado: boolean) => {
    toast.success(
      criado
        ? `Evento criado na Agenda para ${dataFmt}.`
        : `Evento atualizado na Agenda para ${dataFmt}.`,
      {
        action: {
          label: "Ver na Agenda",
          onClick: () => router.push("/agenda"),
        },
      }
    );
    onClose();
  };

  const executar = async (atualizar: boolean) => {
    if (processando) return;
    setProcessando(true);
    try {
      await criarEvento(atualizar);
      sucesso(!atualizar);
    } catch (err) {
      const code = (err as ApiError)?.error?.code;
      // Já existe um evento de follow-up nessa data → oferece atualizar.
      if (code === "EVENTO_FOLLOWUP_EXISTE" && !atualizar) {
        setEtapa("atualizar");
      } else {
        toast.error(getErrorMessage(err), { duration: 7000 });
        onClose();
      }
    } finally {
      setProcessando(false);
    }
  };

  if (etapa === "atualizar") {
    return (
      <ConfirmDialog
        open
        danger={false}
        processando={processando}
        titulo="Atualizar evento na Agenda?"
        mensagem={
          <>
            Já existe um evento de follow-up com{" "}
            <span className="text-foreground font-medium">{clienteNome}</span> na
            Agenda. Quer atualizá-lo para <span className="text-foreground font-medium">{dataFmt}</span>?
          </>
        }
        confirmLabel="Sim, atualizar"
        cancelLabel="Não"
        onConfirm={() => executar(true)}
        onCancel={onClose}
      />
    );
  }

  return (
    <ConfirmDialog
      open
      danger={false}
      processando={processando}
      titulo="Adicionar à Agenda?"
      mensagem={
        <>
          Follow-up com <span className="text-foreground font-medium">{clienteNome}</span>{" "}
          agendado para <span className="text-foreground font-medium">{dataFmt}</span>. Quer
          adicionar à sua Agenda?
        </>
      }
      confirmLabel="Sim"
      cancelLabel="Não agora"
      onConfirm={() => executar(false)}
      onCancel={onClose}
    />
  );
}
