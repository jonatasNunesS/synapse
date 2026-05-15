"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  MessageCircle,
  Eye,
  AlertCircle,
} from "lucide-react";
import type { ClienteList, StatusFunil } from "@/types/clientes";
import { STATUS_FUNIL_LABELS, STATUS_FUNIL_COLORS } from "@/types/clientes";
import type { FiltrosClientes } from "@/hooks/useClientes";

interface ClienteTableProps {
  clientes: ClienteList[];
  loading?: boolean;
  onNovo?: () => void;
  onEditar?: (cliente: ClienteList) => void;
  onDeletar?: (id: string) => void;
  onFiltrar?: (filtros: FiltrosClientes) => void;
  pagination?: { count: number; page: number };
  onPageChange?: (page: number) => void;
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todos os status" },
  { value: "lead", label: "Lead" },
  { value: "contato", label: "Contato" },
  { value: "proposta", label: "Proposta" },
  { value: "negociacao", label: "Negociação" },
  { value: "fechado", label: "Fechado" },
  { value: "perdido", label: "Perdido" },
];

const ORIGEM_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todas as origens" },
  { value: "indicacao", label: "Indicação" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "google", label: "Google" },
  { value: "site", label: "Site" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "outro", label: "Outro" },
];

function StatusBadge({ status }: { status: StatusFunil }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white ${STATUS_FUNIL_COLORS[status]}`}
    >
      {STATUS_FUNIL_LABELS[status]}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-white/5">
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-white/5 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

export function ClienteTable({
  clientes,
  loading,
  onNovo,
  onEditar,
  onDeletar,
  onFiltrar,
  pagination,
  onPageChange,
}: ClienteTableProps) {
  const [busca, setBusca] = useState("");
  const [statusFunil, setStatusFunil] = useState("");
  const [origem, setOrigem] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const handleFiltrar = () => {
    onFiltrar?.({ busca, status_funil: statusFunil, origem });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleFiltrar();
  };

  const totalPages = pagination ? Math.ceil(pagination.count / 25) : 1;
  const currentPage = pagination?.page ?? 1;

  return (
    <div className="bg-[#0f1117] border border-white/10 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail ou telefone..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={statusFunil}
            onChange={(e) => {
              setStatusFunil(e.target.value);
              onFiltrar?.({ busca, status_funil: e.target.value, origem });
            }}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-[#0f1117]">
                {o.label}
              </option>
            ))}
          </select>

          <select
            value={origem}
            onChange={(e) => {
              setOrigem(e.target.value);
              onFiltrar?.({ busca, status_funil: statusFunil, origem: e.target.value });
            }}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
          >
            {ORIGEM_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-[#0f1117]">
                {o.label}
              </option>
            ))}
          </select>

          <button
            onClick={handleFiltrar}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 hover:bg-white/10 transition-colors flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filtrar</span>
          </button>

          <button
            onClick={onNovo}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm text-white transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Novo</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left">
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
                Cliente
              </th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide hidden md:table-cell">
                Contato
              </th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
                Status
              </th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide hidden lg:table-cell">
                Origem
              </th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide hidden lg:table-cell">
                Compras
              </th>
              <th className="px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
            ) : clientes.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  Nenhum cliente encontrado.
                </td>
              </tr>
            ) : (
              clientes.map((cliente) => (
                <tr
                  key={cliente.id}
                  className="border-b border-white/5 hover:bg-white/3 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center text-purple-400 font-semibold text-sm flex-shrink-0">
                        {cliente.nome.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <Link
                          href={`/clientes/${cliente.id}`}
                          className="font-medium text-white hover:text-purple-400 transition-colors"
                        >
                          {cliente.nome}
                        </Link>
                        {cliente.followup_atrasado && (
                          <span className="ml-2 inline-flex items-center gap-1 text-xs text-red-400">
                            <AlertCircle className="w-3 h-3" />
                            Follow-up atrasado
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="text-gray-400 text-xs">
                      {cliente.email && <div>{cliente.email}</div>}
                      {cliente.telefone && <div>{cliente.telefone}</div>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={cliente.status_funil} />
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-400 text-xs">
                    {cliente.origem_display}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="text-white text-xs">
                      {cliente.quantidade_compras > 0 ? (
                        <>
                          <div className="font-medium">
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(parseFloat(cliente.valor_total_compras))}
                          </div>
                          <div className="text-gray-500">{cliente.quantidade_compras} compras</div>
                        </>
                      ) : (
                        <span className="text-gray-600">Sem compras</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {cliente.link_whatsapp && (
                        <a
                          href={cliente.link_whatsapp}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-green-400 hover:bg-green-400/10 rounded transition-colors"
                          title="WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                      )}
                      <Link
                        href={`/clientes/${cliente.id}`}
                        className="p-1.5 text-gray-400 hover:bg-white/10 rounded transition-colors"
                        title="Ver detalhes"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <div className="relative">
                        <button
                          onClick={() =>
                            setOpenMenu(openMenu === cliente.id ? null : cliente.id)
                          }
                          className="p-1.5 text-gray-400 hover:bg-white/10 rounded transition-colors"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {openMenu === cliente.id && (
                          <div className="absolute right-0 top-8 z-10 w-40 bg-[#1a1d27] border border-white/10 rounded-lg shadow-xl py-1">
                            <button
                              onClick={() => {
                                onEditar?.(cliente);
                                setOpenMenu(null);
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-white/5 flex items-center gap-2"
                            >
                              <Pencil className="w-3.5 h-3.5" /> Editar
                            </button>
                            <button
                              onClick={() => {
                                onDeletar?.(cliente.id);
                                setOpenMenu(null);
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-400/10 flex items-center gap-2"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Excluir
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.count > 25 && (
        <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between text-sm text-gray-400">
          <span>
            {pagination.count} clientes • Página {currentPage} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange?.(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-white/5 rounded disabled:opacity-40 hover:bg-white/10 transition-colors"
            >
              Anterior
            </button>
            <button
              onClick={() => onPageChange?.(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-white/5 rounded disabled:opacity-40 hover:bg-white/10 transition-colors"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
