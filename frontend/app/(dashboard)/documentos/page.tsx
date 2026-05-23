"use client";

import { useState } from "react";
import { FileText, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDocumentos } from "@/hooks/useDocumentos";
import { DocumentoCard } from "@/components/documentos/DocumentoCard";
import { DocumentoForm } from "@/components/documentos/DocumentoForm";
import type { Documento, DocumentoFormData } from "@/types/documentos";
import { TIPO_DOCUMENTO_LABELS, STATUS_DOCUMENTO_LABELS } from "@/types/documentos";

export default function DocumentosPage() {
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [docEditando, setDocEditando] = useState<Documento | null>(null);

  const { documentos, pagination, isLoading, criarDocumento, atualizarDocumento, deletarDocumento } =
    useDocumentos({
      busca: busca || undefined,
      tipo: filtroTipo !== "todos" ? filtroTipo : undefined,
      status: filtroStatus !== "todos" ? filtroStatus : undefined,
      page,
    });

  const handleSalvar = async (dados: DocumentoFormData) => {
    if (docEditando) {
      await atualizarDocumento(docEditando.id, dados);
    } else {
      await criarDocumento(dados);
    }
  };

  const handleDeletar = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este documento?")) {
      await deletarDocumento(id);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Documentos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie contratos, propostas e documentos da empresa
          </p>
        </div>
        <Button onClick={() => { setDocEditando(null); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Documento
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por título, descrição..."
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={filtroTipo} onValueChange={(v) => { setFiltroTipo(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {Object.entries(TIPO_DOCUMENTO_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={(v) => { setFiltroStatus(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {Object.entries(STATUS_DOCUMENTO_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : documentos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <FileText className="h-12 w-12 opacity-30" />
          <p className="text-lg font-medium">Nenhum documento encontrado</p>
          <Button variant="outline" onClick={() => { setDocEditando(null); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Criar primeiro documento
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {documentos.map((doc) => (
            <DocumentoCard
              key={doc.id}
              documento={doc}
              onEditar={(d) => { setDocEditando(d); setShowForm(true); }}
              onDeletar={handleDeletar}
            />
          ))}
        </div>
      )}

      {/* Paginação */}
      {pagination && pagination.count > 25 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground">
            {pagination.count} documentos no total
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

      {/* Modal */}
      {showForm && (
        <DocumentoForm
          documento={docEditando}
          onSalvar={handleSalvar}
          onFechar={() => { setShowForm(false); setDocEditando(null); }}
        />
      )}
    </div>
  );
}
