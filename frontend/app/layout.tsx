import type { Metadata } from "next";
import {
  Figtree,
  IBM_Plex_Sans,
  Instrument_Serif,
  Inter,
  Outfit,
} from "next/font/google";
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

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  preload: false,
  variable: "--font-plex",
});

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
  variable: "--font-figtree",
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
      className={`dark ${inter.variable} ${instrumentSerif.variable} ${outfit.variable} ${plex.variable} ${figtree.variable}`}
    >
      <head>
        <ScriptTema />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
