"use client";
/**
 * Registrar produto pelo atalho — com o formulário da tela de Estoque.
 *
 * O `ProdutoForm` exige a lista de categorias, e ela vem do mesmo hook que a
 * tela usa. Sem categoria cadastrada não dá para salvar um produto, e o
 * formulário já diz isso do jeito dele — não repetimos a regra aqui.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ProdutoForm } from "@/components/estoque/ProdutoForm";
import { useCategoriasEstoque, useProdutos } from "@/hooks/useEstoque";
import { getErrorMessage } from "@/lib/api";
import type { ProdutoCreate } from "@/types/estoque";

import { LinkTelaCompleta } from "./LinkTelaCompleta";

interface Props {
  onFechar: () => void;
  onIrParaTela: (href: string) => void;
}

export function AcaoRapidaProduto({ onFechar, onIrParaTela }: Props) {
  const { criar } = useProdutos();
  const { categorias, listar } = useCategoriasEstoque();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listar();
  }, [listar]);

  const registrar = async (dados: ProdutoCreate) => {
    setSalvando(true);
    setErro(null);
    try {
      await criar(dados);
      toast.success("Produto cadastrado.", {
        action: { label: "Ver", onClick: () => onIrParaTela("/estoque") },
      });
      onFechar();
    } catch (falha) {
      // O motivo real fica no banner do próprio formulário, que continua aberto.
      setErro(getErrorMessage(falha));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <ProdutoForm
        produto={null}
        categorias={categorias}
        onSubmit={registrar}
        onFechar={onFechar}
        loading={salvando}
        erro={erro}
      />
      <LinkTelaCompleta
        href="/estoque"
        modulo="Estoque"
        onIr={onIrParaTela}
        onFechar={onFechar}
      />
    </>
  );
}
