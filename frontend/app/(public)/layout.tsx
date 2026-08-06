/**
 * Route group público — fora do layout autenticado (sem sidebar, sem header
 * do sistema, sem guard). Aqui moram as fontes da landing, carregadas pelo
 * next/font (nada de <link> para o Google Fonts no head).
 */
import type { ReactNode } from "react";
import { IBM_Plex_Mono, IBM_Plex_Sans, Instrument_Serif } from "next/font/google";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-instrument-serif",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-plex-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-plex-mono",
});

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${instrumentSerif.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      {children}
    </div>
  );
}
