"use client";
/**
 * Painel Administrativo — lista de empresas: busca, filtros (plano/status),
 * ordenação, indicador de saúde por último acesso, badge de status e criação
 * de empresa.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  Coins,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ArrowRight,
  Search,
  Plus,
} from "lucide-react";
import { useEmpresasAdmin } from "@/hooks/usePainelAdmin";
import { CriarEmpresaModal } from "@/components/painel_admin/CriarEmpresaModal";
import { PlanosPrecosSection } from "@/components/painel_admin/PlanosPrecosSection";
import {
  PLANOS,
  SAUDE_COR,
  SAUDE_LABEL,
  saudePorUltimoAcesso,
  type FiltrosEmpresas,
  type OrdenarEmpresas,
  type Plano,
  type StatusEmpresa,
} from "@/types/painel_admin";

const PLANO_COR: Record<string, string> = {
  starter: "bg-slate-500/20 text-foreground-suave",
  pro: "bg-blue-500/20 text-info",
  business: "bg-brand-500/20 text-brand-accent",
  enterprise: "bg-amber-500/20 text-alerta",
};

const ORDENACOES: { value: OrdenarEmpresas; label: string }[] = [
  { value: "-cadastro", label: "Mais recentes" },
  { value: "cadastro", label: "Mais antigas" },
  { value: "nome", label: "Nome (A–Z)" },
  { value: "-nome", label: "Nome (Z–A)" },
  { value: "-uso", label: "Último acesso (recente)" },
  { value: "uso", label: "Último acesso (antigo)" },
];

const selectCls =
  "rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500";

export default function PainelAdminEmpresasPage() {
  const [page, setPage] = useState(1);
  const [buscaInput, setBuscaInput] = useState("");
  const [filtros, setFiltros] = useState<FiltrosEmpresas>({
    busca: "",
    plano: "",
    status: "todas",
    ordenar: "-cadastro",
  });
  const [criando, setCriando] = useState(false);

  const { empresas, pagination, isLoading, mutate } = useEmpresasAdmin(page, filtros);

  const atualizarFiltro = <K extends keyof FiltrosEmpresas>(
    campo: K,
    valor: FiltrosEmpresas[K]
  ) => {
    setPage(1);
    setFiltros((f) => ({ ...f, [campo]: valor }));
  };

  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    atualizarFiltro("busca", buscaInput.trim());
  };

  const totalLabel = useMemo(() => pagination?.count ?? 0, [pagination]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-5 w-5 text-alerta" />
            Empresas
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Todas as empresas da plataforma. {totalLabel} no total.
          </p>
        </div>
        <button
          onClick={() => setCriando(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-slate-950 text-sm font-medium hover:bg-amber-400 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Criar empresa
        </button>
      </div>

      {/* Busca + filtros */}
      <div className="flex flex-col md:flex-row gap-2.5">
        <form onSubmit={buscar} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-suave" />
          <input
            value={buscaInput}
            onChange={(e) => setBuscaInput(e.target.value)}
            placeholder="Buscar por nome da empresa ou email de usuário…"
            className="w-full rounded-lg border border-border bg-secondary pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-suave focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </form>
        <div className="flex gap-2.5">
          <select
            value={filtros.plano}
            onChange={(e) => atualizarFiltro("plano", e.target.value as Plano | "")}
            className={selectCls}
            aria-label="Filtrar por plano"
          >
            <option value="">Todos os planos</option>
            {PLANOS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <select
            value={filtros.status}
            onChange={(e) => atualizarFiltro("status", e.target.value as StatusEmpresa | "todas")}
            className={selectCls}
            aria-label="Filtrar por status"
          >
            <option value="todas">Todos os status</option>
            <option value="ativa">Ativas</option>
            <option value="suspensa">Suspensas</option>
          </select>
          <select
            value={filtros.ordenar}
            onChange={(e) => atualizarFiltro("ordenar", e.target.value as OrdenarEmpresas)}
            className={selectCls}
            aria-label="Ordenar"
          >
            {ORDENACOES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-suave">
                <th className="px-4 py-3 font-medium">Empresa</th>
                <th className="px-4 py-3 font-medium">Status</th>
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
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-suave">
                    <Loader2 className="h-5 w-5 animate-spin inline" />
                  </td>
                </tr>
              )}
              {!isLoading && empresas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-suave">
                    Nenhuma empresa encontrada.
                  </td>
                </tr>
              )}
              {empresas.map((e) => {
                const saude = saudePorUltimoAcesso(e.ultimo_acesso);
                return (
                  <tr
                    key={e.id}
                    className="border-b border-border/60 hover:bg-secondary/40 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${SAUDE_COR[saude]}`}
                          title={SAUDE_LABEL[saude]}
                        />
                        <div>
                          <div className="font-medium text-foreground">{e.nome}</div>
                          <div className="text-xs text-muted-suave">{e.segmento}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {e.status === "suspensa" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/20 text-erro">
                          🔴 Suspensa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-sucesso">
                          🟢 Ativa
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          PLANO_COR[e.plano] ?? "bg-slate-500/20 text-foreground-suave"
                        }`}
                      >
                        {e.plano}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground-suave">{e.total_usuarios}</td>
                    <td className="px-4 py-3 text-foreground-suave">{e.creditos_usados_hoje}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/painel-admin/${e.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-alerta hover:text-alerta"
                      >
                        Detalhes <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {pagination && pagination.total_pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm">
            <span className="text-muted-suave">
              Página {pagination.page} de {pagination.total_pages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!pagination.previous}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-foreground-suave hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!pagination.next}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-foreground-suave hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Próxima <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preços e limites da plataforma (o que a landing pública mostra) */}
      <PlanosPrecosSection />

      {criando && (
        <CriarEmpresaModal
          onClose={() => setCriando(false)}
          onSuccess={() => {
            setPage(1);
            // Empresa recém-criada aparece no topo (ordenação padrão -cadastro).
            setFiltros((f) => ({ ...f, ordenar: "-cadastro" }));
            mutate();
          }}
        />
      )}
    </div>
  );
}
