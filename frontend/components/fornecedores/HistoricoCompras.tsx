"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X, Loader2, ShoppingCart, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useComprasFornecedor } from "@/hooks/useFornecedores";
import { getErrorMessage } from "@/lib/api";
import { AdicionarEstoqueModal } from "@/components/fornecedores/AdicionarEstoqueModal";
import { RegistrarFinanceiroModal } from "@/components/financeiro/RegistrarFinanceiroModal";
import { ApagarComAjustesFlow } from "@/components/clientes/ApagarComAjustesFlow";
import type { CompraFornecedor } from "@/types/fornecedores";
import type { ApiError } from "@/types/api";
import { useModulos } from "@/hooks/useModulos";
import { formatCurrency } from "@/lib/utils";

const STATUS_COMPRA: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-amber-500/15 text-alerta border-amber-500/30" },
  pago: { label: "Pago", color: "bg-emerald-500/15 text-sucesso border-emerald-500/30" },
  cancelado: { label: "Cancelado", color: "bg-red-500/15 text-erro border-red-500/30" },
};


const compraSchema = z.object({
  descricao: z.string({ message: "Descrição é obrigatória" }).min(3, "Mínimo 3 caracteres"),
  valor: z.number({ message: "Informe o valor" }).positive("Valor deve ser positivo"),
  data_compra: z.string({ message: "Data é obrigatória" }).min(1, "Data é obrigatória"),
  numero_nf: z.string().optional(),
  status: z.enum(["pendente", "pago", "cancelado"]),
  data_pagamento: z.string().optional(),
  observacoes: z.string().optional(),
});

type CompraFormValues = z.infer<typeof compraSchema>;

interface NovaCompraFormProps {
  fornecedorId: string;
  onSuccess: (compraCriada?: CompraFornecedor) => void;
  onClose: () => void;
  compraId?: string;
  initialData?: Partial<CompraFormValues>;
}

function NovaCompraForm({ fornecedorId, onSuccess, onClose, compraId, initialData }: NovaCompraFormProps) {
  const { criar, atualizar } = useComprasFornecedor();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!compraId;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CompraFormValues>({
    resolver: zodResolver(compraSchema),
    defaultValues: {
      status: "pendente",
      data_compra: new Date().toISOString().split("T")[0],
      ...initialData,
    },
  });

  const statusWatch = watch("status");

  const onSubmit = async (values: CompraFormValues) => {
    setServerError(null);
    try {
      const payload = Object.fromEntries(
        Object.entries(values).filter(([, v]) => v !== "" && v !== undefined)
      ) as CompraFormValues;
      if (isEdit && compraId) {
        await atualizar(fornecedorId, compraId, payload);
        onSuccess();
      } else {
        const compraCriada = await criar(fornecedorId, payload);
        onSuccess(compraCriada);
      }
    } catch (err: unknown) {
      const e = err as ApiError;
      setServerError(e?.error?.message ?? (isEdit ? "Erro ao editar compra" : "Erro ao registrar compra"));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="text-base font-semibold text-foreground">{isEdit ? "Editar Compra" : "Registrar Compra"}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-superficie-forte hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6">
          {serverError && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-erro">
              {serverError}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Descrição *</label>
              <input {...register("descricao")} placeholder="Descrição da compra" className="w-full rounded-lg border border-border bg-superficie px-3 py-2 text-sm text-foreground placeholder-zinc-600 outline-none focus:border-brand-500/50" />
              {errors.descricao && <p className="mt-1 text-xs text-erro">{errors.descricao.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Valor *</label>
              <input {...register("valor", { valueAsNumber: true })} type="number" step="0.01" placeholder="0,00" className="w-full rounded-lg border border-border bg-superficie px-3 py-2 text-sm text-foreground placeholder-zinc-600 outline-none focus:border-brand-500/50" />
              {errors.valor && <p className="mt-1 text-xs text-erro">{errors.valor.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Data da Compra *</label>
              <input {...register("data_compra")} type="date" className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-brand-500/50" />
              {errors.data_compra && <p className="mt-1 text-xs text-erro">{errors.data_compra.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Nº Nota Fiscal</label>
              <input {...register("numero_nf")} placeholder="NF-001" className="w-full rounded-lg border border-border bg-superficie px-3 py-2 text-sm text-foreground placeholder-zinc-600 outline-none focus:border-brand-500/50" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
              <select {...register("status")} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-brand-500/50">
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            {statusWatch === "pago" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Data de Pagamento</label>
                <input {...register("data_pagamento")} type="date" className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-brand-500/50" />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Observações</label>
              <textarea {...register("observacoes")} rows={2} placeholder="Observações adicionais..." className="w-full rounded-lg border border-border bg-superficie px-3 py-2 text-sm text-foreground placeholder-zinc-600 outline-none focus:border-brand-500/50" />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-superficie hover:text-foreground">
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-60">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar Alterações" : "Registrar Compra"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface HistoricoComprasProps {
  fornecedorId: string;
}

export function HistoricoCompras({ fornecedorId }: HistoricoComprasProps) {
  const { data, total, loading, error, fetch, deletar, apagarComAjustes } =
    useComprasFornecedor();
  const { moduloAtivo } = useModulos();
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<CompraFornecedor | null>(null);
  const [confirmandoDelete, setConfirmandoDelete] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  // Compra com vínculos (estoque/financeiro) → sequência de perguntas de estorno.
  const [apagarFlow, setApagarFlow] = useState<CompraFornecedor | null>(null);
  // Compra recém-criada que pode ir para o estoque
  const [compraParaEstoque, setCompraParaEstoque] = useState<CompraFornecedor | null>(null);
  // Depois do estoque, oferece registrar no financeiro (mesma compra).
  const [compraParaFinanceiro, setCompraParaFinanceiro] = useState<CompraFornecedor | null>(null);
  const { registrarFinanceiro } = useComprasFornecedor();
  const pageSize = 25;

  useEffect(() => {
    fetch(fornecedorId, page);
  }, [fetch, fornecedorId, page]);

  const totalPages = Math.ceil(total / pageSize);

  const handleSuccess = (compraCriada?: CompraFornecedor) => {
    setShowForm(false);
    setEditando(null);
    fetch(fornecedorId, page);
    // Só oferece adicionar ao estoque após CRIAR (não ao editar) e apenas se
    // o módulo Estoque estiver ativo — senão vai direto pro financeiro.
    if (compraCriada) {
      if (moduloAtivo("estoque")) setCompraParaEstoque(compraCriada);
      else setCompraParaFinanceiro(compraCriada);
    }
  };

  // Confirmou o "Sim": se a compra tem vínculos (estoque/financeiro), abre a
  // sequência de perguntas de estorno; senão, apaga direto.
  const confirmarDelete = (c: CompraFornecedor) => {
    if (excluindo) return;
    const temEstoque = moduloAtivo("estoque") && !!c.movimentacao_estoque_info;
    if (temEstoque || c.lancamento_financeiro_info) {
      setConfirmandoDelete(null);
      setApagarFlow(c);
      return;
    }
    handleDeletar(c.id);
  };

  const handleDeletar = async (id: string) => {
    if (excluindo) return; // evita duplo clique / requisição duplicada
    setExcluindo(true);
    try {
      await deletar(fornecedorId, id);
      toast.success("Compra excluída.");
      setConfirmandoDelete(null);
      fetch(fornecedorId, page);
    } catch (err: unknown) {
      // Erro NUNCA calado: mostra a mensagem real do backend
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setExcluindo(false);
    }
  };

  // Executa o apagar com as escolhas de estorno/financeiro coletadas no fluxo.
  const finalizarApagarComAjustes = async (
    estornarEstoque: boolean,
    apagarFinanceiro: boolean
  ) => {
    if (!apagarFlow || excluindo) return;
    setExcluindo(true);
    try {
      await apagarComAjustes(apagarFlow.id, {
        estornar_estoque: estornarEstoque,
        apagar_financeiro: apagarFinanceiro,
      });
      toast.success("Compra excluída.");
      setApagarFlow(null);
      fetch(fornecedorId, page);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err), { duration: 7000 });
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-superficie backdrop-blur-sm">


      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-brand-accent" />
          <h3 className="text-sm font-semibold text-foreground">Histórico de Compras</h3>
          {total > 0 && (
            <span className="rounded-full bg-brand-500/20 px-2 py-0.5 text-xs text-brand-accent">
              {total}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600/20 px-3 py-1.5 text-xs font-medium text-brand-accent transition-colors hover:bg-brand-600/30"
        >
          <Plus className="h-3.5 w-3.5" />
          Registrar Compra
        </button>
      </div>

      {/* List */}
      <div className="divide-y divide-border">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-suave">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            Carregando...
          </div>
        )}
        {!loading && error && (
          <p className="py-6 text-center text-sm text-erro">{error}</p>
        )}
        {!loading && !error && data.length === 0 && (
          <div className="py-10 text-center">
            <ShoppingCart className="mx-auto mb-2 h-8 w-8 text-foreground-suave" />
            <p className="text-sm text-muted-suave">Nenhuma compra registrada.</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-xs text-brand-accent hover:text-brand-accent"
            >
              Registrar primeira compra
            </button>
          </div>
        )}
        {!loading && data.map((c: CompraFornecedor) => {
          const status = STATUS_COMPRA[c.status] ?? { label: c.status, color: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30" };
          return (
            <div key={c.id} className="flex items-start justify-between px-5 py-3.5 transition-colors hover:bg-superficie">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{c.descricao}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-suave">
                  <span>{new Date(c.data_compra).toLocaleDateString("pt-BR")}</span>
                  {c.numero_nf && <span>NF: {c.numero_nf}</span>}
                  {c.criado_por_nome && <span>por {c.criado_por_nome}</span>}
                </div>
                {c.observacoes && (
                  <p className="mt-1 text-xs text-muted-foreground">{c.observacoes}</p>
                )}
              </div>
              <div className="ml-4 flex flex-col items-end gap-1.5">
                <span className="font-mono text-sm font-semibold text-foreground">
                  {formatCurrency(c.valor)}
                </span>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${status.color}`}>
                  {status.label}
                </span>
                <div className="flex items-center gap-1 mt-0.5">
                  <button
                    onClick={() => setEditando(c)}
                    className="p-1 rounded text-muted-suave hover:text-brand-accent hover:bg-brand-500/10 transition-colors"
                    title="Editar compra"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  {confirmandoDelete === c.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => confirmarDelete(c)}
                        disabled={excluindo}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-red-500/20 text-erro hover:bg-red-500/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {excluindo && <Loader2 className="h-3 w-3 animate-spin" />}
                        Sim
                      </button>
                      <button
                        onClick={() => setConfirmandoDelete(null)}
                        disabled={excluindo}
                        className="px-1.5 py-0.5 rounded text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmandoDelete(c.id)}
                      className="p-1 rounded text-muted-suave hover:text-erro hover:bg-red-500/10 transition-colors"
                      title="Excluir compra"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <span className="text-xs text-muted-suave">{total} compra{total !== 1 ? "s" : ""}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded p-1 text-muted-foreground hover:bg-superficie-forte disabled:opacity-40">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded p-1 text-muted-foreground hover:bg-superficie-forte disabled:opacity-40">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <NovaCompraForm
          fornecedorId={fornecedorId}
          onSuccess={handleSuccess}
          onClose={() => setShowForm(false)}
        />
      )}

      {editando && (
        <NovaCompraForm
          fornecedorId={fornecedorId}
          compraId={editando.id}
          initialData={{
            descricao: editando.descricao,
            valor: typeof editando.valor === "string" ? parseFloat(editando.valor) : editando.valor,
            data_compra: editando.data_compra,
            numero_nf: editando.numero_nf ?? "",
            status: editando.status as "pendente" | "pago" | "cancelado",
            data_pagamento: editando.data_pagamento ?? "",
            observacoes: editando.observacoes ?? "",
          }}
          onSuccess={handleSuccess}
          onClose={() => setEditando(null)}
        />
      )}

      {compraParaEstoque && (
        <AdicionarEstoqueModal
          compra={compraParaEstoque}
          onClose={() => {
            // Ao fechar o estoque (sim ou não), oferece o financeiro.
            setCompraParaFinanceiro(compraParaEstoque);
            setCompraParaEstoque(null);
          }}
          onSuccess={() => fetch(fornecedorId, page)}
        />
      )}

      {compraParaFinanceiro && (
        <RegistrarFinanceiroModal
          tipo="despesa"
          valor={String(compraParaFinanceiro.valor)}
          contraparteLabel="Fornecedor"
          contraparteNome={compraParaFinanceiro.fornecedor_nome}
          jaRegistrado={compraParaFinanceiro.ja_no_financeiro}
          registrar={() => registrarFinanceiro(compraParaFinanceiro.id)}
          onClose={() => setCompraParaFinanceiro(null)}
          onSuccess={() => fetch(fornecedorId, page)}
        />
      )}

      {/* Apagar compra com vínculos → perguntas de estorno/financeiro */}
      {apagarFlow && (
        <ApagarComAjustesFlow
          tipoFinanceiro="despesa"
          movimentacaoInfo={
            moduloAtivo("estoque") ? apagarFlow.movimentacao_estoque_info : null
          }
          lancamentoInfo={apagarFlow.lancamento_financeiro_info}
          processando={excluindo}
          onFinalizar={finalizarApagarComAjustes}
        />
      )}
    </div>
  );
}
