import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="tema-app flex min-h-screen items-center justify-center bg-background px-4 py-12">
      {/*
        Brilho decorativo na cor da paleta. A opacidade vem de um token
        (--glow-opacidade) porque o que funciona nos dois modos é bem
        diferente: sobre o fundo escuro o halo dá profundidade; sobre o branco,
        na mesma força, ele não lê como luz — lê como sujeira na tela. No claro
        cai para metade, só o suficiente para a paleta aparecer.
      */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-brand-600 blur-3xl"
          style={{ opacity: "var(--glow-opacidade)" }}
        />
        <div
          className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-brand-800 blur-3xl"
          style={{ opacity: "var(--glow-opacidade)" }}
        />
      </div>
      <div className="relative w-full max-w-lg">{children}</div>
    </div>
  );
}
