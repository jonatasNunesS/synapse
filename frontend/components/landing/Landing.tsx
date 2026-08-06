"use client";
/**
 * Landing pública do Synapse — composição das 10 seções.
 *
 * Conversão do HTML original (Claude Design Canvas) para React: os bindings
 * `{{ }}`/`sc-if` viraram estado e renderização condicional, o support.js foi
 * descartado e as animações de rolagem estão em hooks/useLandingMotion.
 * Os estilos seguem inline, com os MESMOS valores do original.
 */
import { useRef } from "react";
import { useReveal } from "@/hooks/useLandingMotion";
import estilos from "./landing.module.css";
import { LandingHeader } from "./LandingHeader";
import { HeroSection } from "./HeroSection";
import { ProblemaSection } from "./ProblemaSection";
import { ComoFuncionaSection } from "./ComoFuncionaSection";
import { ModulosSection } from "./ModulosSection";
import { IASection } from "./IASection";
import { PersonalizacaoSection } from "./PersonalizacaoSection";
import { ProvaSection } from "./ProvaSection";
import { PlanosSection } from "./PlanosSection";
import { FaqSection } from "./FaqSection";
import { FechamentoSection } from "./FechamentoSection";
import { LandingFooter } from "./LandingFooter";

interface Props {
  /** `mostrarProva` do original: a seção de depoimento/números. */
  mostrarProva?: boolean;
}

export function Landing({ mostrarProva = true }: Props) {
  const raiz = useRef<HTMLDivElement>(null);
  useReveal(raiz);

  return (
    <div ref={raiz} className={estilos.landing}>
      <LandingHeader />
      <main id="topo">
        <HeroSection />
        <ProblemaSection />
        <ComoFuncionaSection />
        <ModulosSection />
        <IASection />
        <PersonalizacaoSection />
        {mostrarProva && <ProvaSection />}
        <PlanosSection />
        <FaqSection />
        <FechamentoSection />
      </main>
      <LandingFooter />
    </div>
  );
}
