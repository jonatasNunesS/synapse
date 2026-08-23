"use client";

import { useState } from "react";
import { Building2, Tag } from "lucide-react";
import { ResumoCards } from "@/components/fornecedores/ResumoCards";
import { FornecedorTable } from "@/components/fornecedores/FornecedorTable";
import { RankingFornecedores } from "@/components/fornecedores/RankingFornecedores";
import { FornecedorForm } from "@/components/fornecedores/FornecedorForm";
import { CategoriaFornecedorModal } from "@/components/fornecedores/CategoriaFornecedorModal";
import type { FornecedorDetail } from "@/types/fornecedores";

export default function FornecedoresPage() {
  const [showForm, setShowForm] = useState(false);
  const [showCategorias, setShowCategorias] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSuccess = (_fornecedor: FornecedorDetail) => {
    setShowForm(false);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      {/* flex-wrap: com o texto grande, o botão desce em vez de esticar a
          página para fora da tela. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10">
            <Building2 className="h-5 w-5 text-brand-accent" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Fornecedores</h1>
            <p className="text-sm text-muted-suave">
              Gerencie seus fornecedores e acompanhe o Score Synapse
            </p>
          </div>
        </div>
        {/* Botão Gerenciar Categorias */}
        <button
          onClick={() => setShowCategorias(true)}
          className="flex items-center gap-2 rounded-lg border border-border bg-secondary/60 px-3 py-2 text-sm text-foreground-suave hover:bg-superficie-forte hover:text-foreground transition-colors"
        >
          <Tag className="h-4 w-4 text-brand-accent" />
          Gerenciar Categorias
        </button>
      </div>

      {/* KPI Cards */}
      <ResumoCards key={`resumo-${refreshKey}`} />

      {/* Main content: table + ranking */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Table — 2/3 width */}
        <div className="xl:col-span-2">
          <FornecedorTable
            key={`table-${refreshKey}`}
            onNovo={() => setShowForm(true)}
          />
        </div>

        {/* Ranking — 1/3 width */}
        <div>
          <RankingFornecedores key={`ranking-${refreshKey}`} />
        </div>
      </div>

      {/* Modal de Categorias */}
      {showCategorias && (
        <CategoriaFornecedorModal onFechar={() => setShowCategorias(false)} />
      )}

      {/* New Fornecedor Modal */}
      {showForm && (
        <FornecedorForm
          onSuccess={handleSuccess}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
