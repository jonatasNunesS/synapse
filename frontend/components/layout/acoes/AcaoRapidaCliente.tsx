"use client";
/**
 * Registrar cliente pelo atalho — com o formulário da tela de Clientes.
 *
 * Mesmo `ClienteForm`, mesmo `criar` do hook. O erro do backend continua
 * mantendo o modal aberto para a pessoa corrigir, como lá.
 */
import { useState } from "react";
import { toast } from "sonner";

import { ClienteForm } from "@/components/clientes/ClienteForm";
import { useClientes } from "@/hooks/useClientes";
import { getErrorMessage } from "@/lib/api";

import { LinkTelaCompleta } from "./LinkTelaCompleta";

interface Props {
  onFechar: () => void;
  onIrParaTela: (href: string) => void;
}

export function AcaoRapidaCliente({ onFechar, onIrParaTela }: Props) {
  const { criar } = useClientes();
  const [salvando, setSalvando] = useState(false);

  const registrar = async (dados: Parameters<typeof criar>[0]) => {
    setSalvando(true);
    try {
      const novo = await criar(dados);
      toast.success("Cliente cadastrado.", {
        action: { label: "Ver", onClick: () => onIrParaTela(`/clientes/${novo.id}`) },
      });
      onFechar();
    } catch (erro) {
      // Erro nunca calado, e o modal fica aberto com o que foi digitado.
      toast.error(getErrorMessage(erro), { duration: 7000 });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <ClienteForm
        onSubmit={registrar as Parameters<typeof ClienteForm>[0]["onSubmit"]}
        onClose={onFechar}
        loading={salvando}
      />
      <LinkTelaCompleta
        href="/clientes"
        modulo="Clientes"
        onIr={onIrParaTela}
        onFechar={onFechar}
      />
    </>
  );
}
