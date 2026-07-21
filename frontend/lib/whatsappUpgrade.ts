/**
 * WhatsApp de upgrade de plano — conecta o desejo do cliente ("quero mais
 * créditos") à ação do fundador (trocar o plano no painel admin).
 *
 * O número do fundador vem de NEXT_PUBLIC_WHATSAPP_UPGRADE (só dígitos, com
 * código do país). Se a variável NÃO estiver definida, buildUpgradeWhatsappUrl
 * retorna null e NENHUM botão de upgrade aparece — degradação graciosa, sem
 * link morto para número vazio.
 */

interface UpgradeParams {
  /** Número do fundador (NEXT_PUBLIC_WHATSAPP_UPGRADE). Só dígitos. */
  numero?: string | null;
  nome?: string | null;
  empresa?: string | null;
  plano?: string | null;
}

/**
 * Monta a URL wa.me com a mensagem pré-preenchida. Retorna null quando o
 * número não está configurado (variável de ambiente ausente/vazia).
 */
export function buildUpgradeWhatsappUrl({
  numero,
  nome,
  empresa,
  plano,
}: UpgradeParams): string | null {
  const digitos = (numero ?? "").replace(/\D/g, "");
  if (!digitos) return null; // sem número → sem botão

  const nomeUsuario = nome?.trim() || "cliente";
  const nomeEmpresa = empresa?.trim() || "minha empresa";
  const planoAtual = plano?.trim() || "atual";

  const mensagem =
    `Olá! Sou ${nomeUsuario} da empresa ${nomeEmpresa} ` +
    `(plano ${planoAtual}) e gostaria de fazer upgrade do meu plano Synapse.`;

  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensagem)}`;
}
