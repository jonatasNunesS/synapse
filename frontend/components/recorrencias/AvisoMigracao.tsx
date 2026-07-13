"use client";
/**
 * Aviso único (pós-deploy) de que as recorrências antigas migraram pro novo
 * modelo. Aparece no primeiro login de quem ainda não viu; ao dispensar (ou
 * clicar em "Ver recorrências"), grava a flag no usuário pra não repetir.
 */
import { useState } from "react";
import Link from "next/link";
import { Repeat, X, ArrowRight } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { api } from "@/lib/api";

export function AvisoMigracaoRecorrencias() {
  const { usuario, setUsuario } = useAppStore();
  const [fechado, setFechado] = useState(false);

  if (!usuario || usuario.viu_aviso_recorrencias || fechado) return null;

  const dispensar = async () => {
    setFechado(true);
    try {
      await api.post("/recorrencias/aviso-visto/");
      setUsuario({ ...usuario, viu_aviso_recorrencias: true });
    } catch {
      // silencioso: se falhar, o aviso reaparece no próximo login (aceitável)
    }
  };

  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-4 flex items-start gap-3">
      <div className="h-9 w-9 rounded-lg bg-violet-500/20 text-violet-300 flex items-center justify-center flex-shrink-0">
        <Repeat className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">
          Suas recorrências passaram pro novo modelo
        </p>
        <p className="text-xs text-zinc-300 mt-0.5">
          Agora você confirma cada uma pelo sino de notificações — nada vira
          lançamento antes de você dizer que aconteceu.
        </p>
        <Link
          href="/financeiro/recorrencias"
          onClick={dispensar}
          className="inline-flex items-center gap-1 text-xs font-medium text-violet-300 hover:text-violet-200 mt-2"
        >
          Ver recorrências <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <button
        onClick={dispensar}
        className="p-1 text-zinc-400 hover:text-white transition-colors flex-shrink-0"
        title="Dispensar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
