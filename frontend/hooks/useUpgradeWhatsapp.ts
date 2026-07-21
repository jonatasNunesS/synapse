"use client";
/**
 * Monta a URL de upgrade via WhatsApp já com o nome do usuário, a empresa e
 * o plano atual preenchidos. Retorna null quando NEXT_PUBLIC_WHATSAPP_UPGRADE
 * não está definida — os botões que dependem disso simplesmente não aparecem.
 */
import { useAuth } from "@/hooks/useAuth";
import { buildUpgradeWhatsappUrl } from "@/lib/whatsappUpgrade";
import { PLANO_LABELS } from "@/types/auth";

export function useUpgradeWhatsappUrl(): string | null {
  const { usuario, empresa } = useAuth();
  const plano = empresa?.plano ? PLANO_LABELS[empresa.plano] : undefined;

  return buildUpgradeWhatsappUrl({
    // Acesso direto ao literal para o Next inlinar em build
    numero: process.env.NEXT_PUBLIC_WHATSAPP_UPGRADE,
    nome: usuario?.nome,
    empresa: empresa?.nome,
    plano,
  });
}
