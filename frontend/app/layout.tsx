import type { Metadata } from "next";
import {
  Figtree,
  IBM_Plex_Sans,
  Instrument_Serif,
  Inter,
  Outfit,
} from "next/font/google";
import "./globals.css";
import { ObservadorModo } from "@/components/tema/ObservadorModo";
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
    // A classe `dark` saiu daqui: quem decide o modo agora é o ScriptTema,
    // antes do primeiro paint (cookie do usuário ou prefers-color-scheme).
    // Como ele mexe no <html> antes da hidratação, o suppressHydrationWarning
    // evita o aviso de divergência entre o HTML do servidor e o do cliente.
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${inter.variable} ${instrumentSerif.variable} ${outfit.variable} ${plex.variable} ${figtree.variable}`}
    >
      <head>
        <ScriptTema />
      </head>
      <body className="font-sans">
        <ObservadorModo />
        {children}
      </body>
    </html>
  );
}
