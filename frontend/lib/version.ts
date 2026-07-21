/**
 * Versão do sistema — fonte única de verdade é o campo "version" do
 * package.json, injetado em build via NEXT_PUBLIC_APP_VERSION
 * (ver next.config.mjs). O hash curto do commit é opcional
 * (NEXT_PUBLIC_GIT_SHA, setado como build arg no Docker).
 *
 * Serve para o fundador bater o olho no rodapé e confirmar que o build
 * no ar é o atual — foi exatamente o que travou o projeto por semanas.
 */

/** Monta o rótulo de versão. SHA só aparece se for um valor real de build. */
export function buildVersionLabel(version: string, sha?: string): string {
  const temSha = !!sha && sha !== "dev";
  return temSha ? `v${version} · ${sha}` : `v${version}`;
}

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
export const GIT_SHA = process.env.NEXT_PUBLIC_GIT_SHA ?? "dev";

export const VERSION_LABEL = buildVersionLabel(APP_VERSION, GIT_SHA);
