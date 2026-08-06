/**
 * Roteamento público: "/" é a landing para visitante e vai para /dashboard
 * para quem já tem sessão. O resto do sistema segue protegido.
 */
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

function pedir(caminho: string, autenticado = false) {
  const req = new NextRequest(new URL(caminho, "https://synapse.app"));
  if (autenticado) req.cookies.set("access_token", "jwt-de-teste");
  return middleware(req);
}

/** Para onde o middleware mandou (null = deixou passar). */
function destino(resposta: Response): string | null {
  const location = resposta.headers.get("location");
  return location ? new URL(location).pathname + new URL(location).search : null;
}

describe("middleware — landing pública", () => {
  it("visitante em '/' vê a landing (não redireciona)", () => {
    const resp = pedir("/");
    expect(resp.status).toBe(200);
    expect(destino(resp)).toBeNull();
  });

  it("usuário logado em '/' vai para o dashboard", () => {
    const resp = pedir("/", true);
    expect(destino(resp)).toBe("/dashboard");
  });

  it("visitante em rota protegida vai para o login com o redirect", () => {
    const resp = pedir("/financeiro");
    expect(destino(resp)).toBe("/login?redirect=%2Ffinanceiro");
  });

  it("visitante pode abrir login e registro", () => {
    expect(destino(pedir("/login"))).toBeNull();
    expect(destino(pedir("/registro"))).toBeNull();
  });

  it("usuário logado em /login volta para o dashboard", () => {
    expect(destino(pedir("/login", true))).toBe("/dashboard");
  });

  it("usuário logado acessa o dashboard normalmente", () => {
    expect(destino(pedir("/dashboard", true))).toBeNull();
  });

  it("assets e API passam direto", () => {
    expect(destino(pedir("/_next/static/chunk.js"))).toBeNull();
    expect(destino(pedir("/api/planos/"))).toBeNull();
    expect(destino(pedir("/favicon.ico"))).toBeNull();
  });
});
