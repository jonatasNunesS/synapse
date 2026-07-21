"use client";
/**
 * Botão verde WhatsApp que leva o cliente ao fundador para fazer upgrade.
 * Abre em nova aba com a mensagem pré-preenchida (nome, empresa, plano).
 *
 * Degradação graciosa: se NEXT_PUBLIC_WHATSAPP_UPGRADE não estiver definida,
 * o botão simplesmente não renderiza (retorna null) — sem erro, sem botão
 * morto.
 */
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpgradeWhatsappUrl } from "@/hooks/useUpgradeWhatsapp";

interface UpgradeWhatsappButtonProps {
  label?: string;
  className?: string;
  size?: "sm" | "md";
}

// Verde oficial do WhatsApp (#25D366) com hover levemente mais escuro.
const BASE =
  "inline-flex items-center gap-1.5 rounded-lg font-medium text-white " +
  "bg-[#25D366] hover:bg-[#1ebe5b] transition-colors";
const SIZES = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-4 py-2 text-sm",
} as const;

export function UpgradeWhatsappButton({
  label = "Fazer upgrade",
  className,
  size = "md",
}: UpgradeWhatsappButtonProps) {
  const url = useUpgradeWhatsappUrl();
  if (!url) return null; // sem número configurado → sem botão

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(BASE, SIZES[size], className)}
    >
      <MessageCircle className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      {label}
    </a>
  );
}
