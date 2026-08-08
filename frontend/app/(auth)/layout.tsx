import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="tema-app flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      {/* Gradiente de fundo decorativo */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-brand-600/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-brand-800/10 blur-3xl" />
      </div>
      <div className="relative w-full max-w-lg">{children}</div>
    </div>
  );
}
