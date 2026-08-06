"use client";
/**
 * Landing — preços e limites dos planos (GET /api/planos/, público).
 *
 * A landing NUNCA depende dessa chamada para renderizar: começa com o
 * fallback estático (tudo "a definir", o comportamento de hoje) e só troca se
 * a API responder. Se a API cair, a página continua de pé.
 */
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export type NomePlano = "starter" | "pro" | "business";

export interface PlanoPublico {
  plano: NomePlano;
  preco_mensal: string | null;
  preco_anual: string | null;
  limite_usuarios: number | null;
  limite_armazenamento_gb: number | null;
  descricao_suporte: string;
  ativo: boolean;
}

function vazio(plano: NomePlano): PlanoPublico {
  return {
    plano,
    preco_mensal: null,
    preco_anual: null,
    limite_usuarios: null,
    limite_armazenamento_gb: null,
    descricao_suporte: "",
    ativo: true,
  };
}

/** Sem resposta da API: os 3 planos sem preço definido. */
export const PLANOS_FALLBACK: PlanoPublico[] = [
  vazio("starter"),
  vazio("pro"),
  vazio("business"),
];

export function usePlanos(): PlanoPublico[] {
  const [planos, setPlanos] = useState<PlanoPublico[]>(PLANOS_FALLBACK);

  useEffect(() => {
    let ativo = true;
    api
      .get<PlanoPublico[]>("/planos/")
      .then((resp) => {
        if (!ativo) return;
        if (resp.success && Array.isArray(resp.data) && resp.data.length) {
          setPlanos(resp.data);
        }
      })
      .catch(() => {
        // Silencioso de propósito: a landing segue com o fallback.
      });
    return () => {
      ativo = false;
    };
  }, []);

  return planos;
}

/** "R$ 97,00" a partir do decimal em string; null → null. */
export function formatarPreco(valor: string | null): string | null {
  if (valor === null || valor === "") return null;
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return null;
  return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
