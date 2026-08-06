/**
 * "/" — landing pública. Visitante vê esta página; quem já tem sessão é
 * mandado para /dashboard pelo middleware.
 */
import type { Metadata } from "next";
import { Landing } from "@/components/landing/Landing";

const TITULO = "Synapse — Sistema de gestão para pequenos negócios";
const DESCRICAO =
  "Lance a venda uma vez: o Synapse dá baixa no estoque, registra o dinheiro no financeiro e lembra você de cobrar. Onze módulos, e você escolhe quais usar.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRICAO,
  // og:image vem do opengraph-image.tsx desta mesma rota.
  openGraph: {
    title: TITULO,
    description: DESCRICAO,
    type: "website",
    locale: "pt_BR",
    siteName: "Synapse",
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: DESCRICAO,
  },
};

export default function LandingPage() {
  return <Landing />;
}
