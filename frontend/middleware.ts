/**
 * Synapse — M1: Middleware de Proteção de Rotas
 * Verifica cookie de access_token em toda requisição.
 * Rotas públicas: /login, /registro, /recuperar-senha, /redefinir-senha
 * Qualquer outra rota sem token → redirect /login
 * Usuário logado acessando /login → redirect /
 */

import { NextRequest, NextResponse } from "next/server";

// Rotas que não requerem autenticação
const PUBLIC_ROUTES = [
  "/login",
  "/registro",
  "/recuperar-senha",
  "/redefinir-senha",
];

// Rotas estáticas do Next.js (ignorar)
const NEXT_STATIC = ["/_next", "/favicon.ico", "/api"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ignorar rotas estáticas e de API
  if (NEXT_STATIC.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get("access_token")?.value;
  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  // Usuário autenticado tentando acessar rota pública → redirecionar para dashboard
  if (accessToken && isPublicRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Usuário não autenticado tentando acessar rota protegida → redirecionar para login
  if (!accessToken && !isPublicRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Aplicar middleware em todas as rotas exceto:
     * - _next/static (arquivos estáticos)
     * - _next/image (otimização de imagens)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
