import type { Metadata } from "next";
import { Inter, Instrument_Serif, Outfit } from "next/font/google";
import "./globals.css";
import { ScriptTema } from "@/components/tema/ScriptTema";

// Fonte de leitura: sempre carregada (corpo de texto, tabelas e números).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

// Fontes de TÍTULO das identidades opcionais. `preload: false` de propósito:
// o navegador só baixa o arquivo se a empresa tiver escolhido aquela fonte —
// nenhuma delas entra no caminho crítico de quem está no tema padrão.
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  preload: false,
  variable: "--font-serifada",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  preload: false,
  variable: "--font-geometrica",
});

export const metadata: Metadata = {
  title: "Synapse - Gestão Empresarial com IA",
  description:
    "Plataforma SaaS all-in-one de gestão empresarial com inteligência artificial para empreendedores brasileiros.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`dark ${inter.variable} ${instrumentSerif.variable} ${outfit.variable}`}
    >
      <head>
        <ScriptTema />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
