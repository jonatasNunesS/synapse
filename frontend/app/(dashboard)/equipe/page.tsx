"use client";

import { useState } from "react";
import { UserCog, Plus, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMembros } from "@/hooks/useEquipe";
import { ResumoEquipeCards } from "@/components/equipe/ResumoEquipeCards";
import { MembroCard } from "@/components/equipe/MembroCard";
import { MembroForm } from "@/components/equipe/MembroForm";
import type { MembroEquipe, MembroFormData } from "@/types/equipe";
import { ConvidarModal } from "@/components/equipe/ConvidarModal";

export default function EquipePage() {
  const [busca, setBusca] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState<string>("todos");
  const [filtroDept, setFiltroDept] = useState<string>("todos");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [showConvidar, setShowConvidar] = useState(false);
  const [membroEditando, setMembroEditando] = useState<MembroEquipe | null>(null);

  const { membros, pagination, isLoading, adicionarMembro, atualizarMembro, removerMembro } =
    useMembros({
      busca: busca || undefined,
      ativo:
        filtroAtivo === "ativos" ? true : filtroAtivo === "inativos" ? false : undefined,
      departamento: filtroDept !== "todos" ? filtroDept : undefined,
      page,
    });

  const departamentos = Array.from(
    new Set(membros.map((m) => m.departamento).filter(Boolean))
  );

  const handleSalvar = async (dados: MembroFormData) => {
    if (membroEditando) {
      await atualizarMembro(membroEditando.id, dados);
    } else {
      await adicionarMembro(dados);
    }
  };

  const handleRemover = async (id: string) => {
    if (confirm("Tem certeza que deseja remover este membro?")) {
      await removerMembro(id);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserCog className="h-6 w-6" />
            Equipe
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os membros da sua equipe e acompanhe metas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowConvidar(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Convidar por E-mail
          </Button>
          <Button onClick={() => { setMembroEditando(null); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Membro
          </Button>
        </div>
      </div>

      {/* Resumo */}
      <ResumoEquipeCards />

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, cargo..."
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={filtroAtivo} onValueChange={(v) => { setFiltroAtivo(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ativos">Ativos</SelectItem>
            <SelectItem value="inativos">Inativos</SelectItem>
          </SelectContent>
        </Select>
        {departamentos.length > 0 && (
          <Select value={filtroDept} onValueChange={(v) => { setFiltroDept(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os depto.</SelectItem>
              {departamentos.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : membros.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <UserCog className="h-12 w-12 opacity-30" />
          <p className="text-lg font-medium">Nenhum membro encontrado</p>
          <Button variant="outline" onClick={() => { setMembroEditando(null); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar primeiro membro
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {membros.map((m) => (
            <MembroCard
              key={m.id}
              membro={m}
              onEditar={(membro) => { setMembroEditando(membro); setShowForm(true); }}
              onRemover={handleRemover}
            />
          ))}
        </div>
      )}

      {/* Paginação */}
      {pagination && pagination.count > 25 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground">
            {pagination.count} membros no total
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!pagination.previous} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={!pagination.next} onClick={() => setPage((p) => p + 1)}>
              Próxima
            </Button>
          </div>
        </div>
      )}

      {/* Modal de Adição */}
      {showForm && (
        <MembroForm
          membro={membroEditando}
          onSalvar={handleSalvar}
          onFechar={() => { setShowForm(false); setMembroEditando(null); }}
        />
      )}

      {/* Modal de Convite — Bug E */}
      {showConvidar && (
        <ConvidarModal
          onFechar={() => setShowConvidar(false)}
          onConvidado={() => { /* mutate é chamado automaticamente via SWR */ }}
        />
      )}
    </div>
  );
}
