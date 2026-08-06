/**
 * Synapse — M1: Middleware de Proteção de Rotas
 * Verifica cookie de access_token em toda requisição.
 * Rota "/" é a landing pública: visitante vê a landing, usuário logado é
 * mandado para /dashboard.
 * Demais rotas públicas: /login, /registro, /recuperar-senha, /redefinir-senha
 * Qualquer outra rota sem token → redirect /login
 * Usuário logado acessando rota pública → redirect /dashboard
 */

import { NextRequest, NextResponse } from "next/server";

// Landing pública — única rota que o visitante vê sem login.
const LANDING_ROUTE = "/";

// Rotas que não requerem autenticação
const PUBLIC_ROUTES = [
  "/login",
  "/registro",
  "/recuperar-senha",
  "/redefinir-senha",
];

// Para onde vai quem já está logado (a raiz agora é a landing).
const HOME_AUTENTICADO = "/dashboard";

// Rotas estáticas do Next.js (ignorar)
const NEXT_STATIC = ["/_next", "/favicon.ico", "/api"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ignorar rotas estáticas e de API
  if (NEXT_STATIC.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get("access_token")?.value;

  // Landing: visitante vê a página; quem já entrou vai direto pro sistema.
  if (pathname === LANDING_ROUTE) {
    return accessToken
      ? NextResponse.redirect(new URL(HOME_AUTENTICADO, request.url))
      : NextResponse.next();
  }

  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  // Usuário autenticado tentando acessar rota pública → redirecionar para dashboard
  if (accessToken && isPublicRoute) {
    return NextResponse.redirect(new URL(HOME_AUTENTICADO, request.url));
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
