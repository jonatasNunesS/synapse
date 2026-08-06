"use client";
/**
 * Landing — cabeçalho fixo (não usa o Header do sistema).
 *
 * Diferença proposital em relação ao HTML original: o botão de cadastro aponta
 * para /registro (a rota que existe no projeto) e o menu ganhou "Entrar" →
 * /login, como pedido no roteamento público.
 */
import Link from "next/link";
import { s } from "./css";
import estilos from "./landing.module.css";
import { MarcaSynapse } from "./MarcaSynapse";

export function LandingHeader() {
  return (
    <header
      style={s(
        "position:sticky;top:0;z-index:50;background:rgba(250,250,249,.96);border-bottom:1px solid rgba(24,24,27,.09)"
      )}
    >
      <div
        style={s(
          "max-width:1180px;margin:0 auto;padding:0 clamp(18px,4vw,36px);height:60px;display:flex;align-items:center;justify-content:space-between;gap:20px"
        )}
      >
        <a
          href="#topo"
          style={s(
            "display:flex;align-items:center;gap:9px;color:#18181B;text-decoration:none"
          )}
        >
          <MarcaSynapse />
          <span style={s("font-size:16.5px;font-weight:600;letter-spacing:-.01em")}>
            Synapse
          </span>
        </a>
        <nav
          style={s("display:flex;align-items:center;gap:clamp(14px,2.4vw,26px)")}
        >
          <a
            href="#como-funciona"
            className={estilos.ancoraSecao}
            style={s("font-size:13.5px;color:#52525B")}
          >
            Como funciona
          </a>
          <a
            href="#modulos"
            className={estilos.ancoraSecao}
            style={s("font-size:13.5px;color:#52525B")}
          >
            Módulos
          </a>
          <a
            href="#planos"
            className={estilos.ancoraSecao}
            style={s("font-size:13.5px;color:#52525B")}
          >
            Planos
          </a>
          <Link href="/login" style={s("font-size:13.5px;color:#52525B")}>
            Entrar
          </Link>
          <Link
            href="/registro"
            className={estilos.ctaHeader}
            style={s(
              "font-size:13.5px;font-weight:500;color:#FAFAF9;background:#18181B;padding:9px 15px;border-radius:7px"
            )}
          >
            Criar conta
          </Link>
        </nav>
      </div>
    </header>
  );
}
