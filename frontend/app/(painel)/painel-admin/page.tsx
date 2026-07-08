"use client";
/**
 * Painel Administrativo — lista de empresas (paginada, com contadores).
 */
import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  Coins,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { useEmpresasAdmin } from "@/hooks/usePainelAdmin";

const PLANO_COR: Record<string, string> = {
  starter: "bg-slate-500/20 text-slate-300",
  pro: "bg-blue-500/20 text-blue-300",
  business: "bg-violet-500/20 text-violet-300",
  enterprise: "bg-amber-500/20 text-amber-300",
};

export default function PainelAdminEmpresasPage() {
  const [page, setPage] = useState(1);
  const { empresas, pagination, isLoading } = useEmpresasAdmin(page);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Building2 className="h-5 w-5 text-amber-400" />
          Empresas
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Todas as empresas da plataforma. {pagination?.count ?? 0} no total.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Empresa</th>
                <th className="px-4 py-3 font-medium">Plano</th>
                <th className="px-4 py-3 font-medium">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> Usuários
                  </span>
                </th>
                <th className="px-4 py-3 font-medium">
                  <span className="inline-flex items-center gap-1">
                    <Coins className="h-3.5 w-3.5" /> Créditos hoje
                  </span>
                </th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin inline" />
                  </td>
                </tr>
              )}
              {!isLoading && empresas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    Nenhuma empresa encontrada.
                  </td>
                </tr>
              )}
              {empresas.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-100">{e.nome}</div>
                    <div className="text-xs text-slate-500">{e.segmento}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        PLANO_COR[e.plano] ?? "bg-slate-500/20 text-slate-300"
                      }`}
                    >
                      {e.plano}
                    </span>
                    {!e.plano_ativo && (
                      <span className="ml-1.5 text-[10px] text-red-400">inativo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{e.num_usuarios}</td>
                  <td className="px-4 py-3 text-slate-300">{e.creditos_usados_hoje}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/painel-admin/${e.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300"
                    >
                      Detalhes <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {pagination && pagination.total_pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 text-sm">
            <span className="text-slate-500">
              Página {pagination.page} de {pagination.total_pages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!pagination.previous}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!pagination.next}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Próxima <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
