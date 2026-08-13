"use client";
/**
 * Seletor de cliente com busca — usado no atalho global de "Nova interação".
 */
import { useEffect, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { useClientes } from "@/hooks/useClientes";

interface ClienteSelectProps {
  onSelect: (cliente: { id: string; nome: string }) => void;
}

export function ClienteSelect({ onSelect }: ClienteSelectProps) {
  const { clientes, loading, carregar } = useClientes();
  const [busca, setBusca] = useState("");

  useEffect(() => {
    const t = setTimeout(() => carregar({ busca: busca || undefined, page: 1 }), 250);
    return () => clearTimeout(t);
  }, [busca, carregar]);

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-suave" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar cliente..."
          aria-label="Buscar cliente"
          className="w-full rounded-lg border border-border bg-superficie py-2 pl-9 pr-3 text-sm text-foreground placeholder-slate-500 outline-none focus:border-brand-500"
        />
      </div>
      <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-border bg-white/[0.02]">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-suave">
            <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
          </div>
        ) : clientes.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-suave">Nenhum cliente encontrado.</p>
        ) : (
          <ul className="divide-y divide-border">
            {clientes.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelect({ id: c.id, nome: c.nome })}
                  className="w-full px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-superficie"
                >
                  {c.nome}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
