"use client";
/**
 * Synapse — Formulário de venda (fase 1).
 *
 * A venda é montada linha a linha: escolhe o produto, ajusta quantidade e
 * preço, repete. O total aparece ao vivo enquanto a pessoa monta — é o que
 * ela precisa ver para decidir o desconto — mas o valor que fica gravado é o
 * que o backend devolve depois de salvar.
 *
 * Cliente é opcional de propósito: venda de balcão não exige inventar um
 * cadastro só para poder registrar.
 */
import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";

import { ProdutoSelect } from "@/components/estoque/ProdutoSelect";
import { useClientes } from "@/hooks/useClientes";
import { getErrorMessage } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import {
  descontoValido,
  subtotalDaVenda,
  subtotalDoItem,
  totalDaVenda,
} from "@/lib/vendas";
import type { ProdutoList } from "@/types/estoque";
import {
  FORMAS_PAGAMENTO,
  type FormaPagamento,
  type ItemEmEdicao,
  type StatusPagamentoVenda,
  type Venda,
  type VendaPayload,
} from "@/types/vendas";

interface Props {
  venda?: Venda | null;
  onSubmit: (dados: VendaPayload) => Promise<unknown>;
  onClose: () => void;
}

const hoje = () => new Date().toISOString().slice(0, 10);

function itensIniciais(venda?: Venda | null): ItemEmEdicao[] {
  if (!venda) return [];
  return venda.itens.map((item) => ({
    chave: item.id,
    produto: item.produto,
    produto_nome: item.produto_nome,
    // Carregada para voltar intacta no envio: sem ela, salvar uma venda que
    // tem item livre apagaria o nome da linha.
    descricao: item.descricao,
    quantidade: item.quantidade,
    preco_unitario: item.preco_unitario,
  }));
}

export function VendaForm({ venda, onSubmit, onClose }: Props) {
  const { clientes, carregar: carregarClientes } = useClientes();

  const [itens, setItens] = useState<ItemEmEdicao[]>(() => itensIniciais(venda));
  const [produtoNovo, setProdutoNovo] = useState<ProdutoList | null>(null);
  const [cliente, setCliente] = useState<string>(venda?.cliente ?? "");
  const [dataVenda, setDataVenda] = useState(venda?.data_venda ?? hoje());
  const [desconto, setDesconto] = useState(venda?.desconto ?? "0");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | "">(
    venda?.forma_pagamento ?? ""
  );
  const [statusPagamento, setStatusPagamento] = useState<StatusPagamentoVenda>(
    venda?.status_pagamento ?? "pago"
  );
  const [observacoes, setObservacoes] = useState(venda?.observacoes ?? "");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    carregarClientes({ page: 1 });
  }, [carregarClientes]);

  const subtotal = subtotalDaVenda(itens);
  const total = totalDaVenda(itens, desconto);
  const descontoCabe = descontoValido(itens, desconto);
  const podeSalvar = itens.length > 0 && descontoCabe && !enviando;

  const adicionarItem = () => {
    if (!produtoNovo) return;
    setItens((atuais) => [
      ...atuais,
      {
        chave: `${produtoNovo.id}-${Date.now()}`,
        produto: produtoNovo.id,
        produto_nome: produtoNovo.nome,
        descricao: "",
        quantidade: "1",
        // Nasce com o preço de tabela; editar é o caso comum, não a exceção.
        preco_unitario: String(produtoNovo.preco_venda ?? "0"),
      },
    ]);
    setProdutoNovo(null);
  };

  const alterarItem = (chave: string, campo: "quantidade" | "preco_unitario", valor: string) => {
    setItens((atuais) =>
      atuais.map((item) => (item.chave === chave ? { ...item, [campo]: valor } : item))
    );
  };

  const removerItem = (chave: string) => {
    setItens((atuais) => atuais.filter((item) => item.chave !== chave));
  };

  const salvar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!podeSalvar) return;
    setErro(null);
    setEnviando(true);
    try {
      await onSubmit({
        cliente: cliente || null,
        data_venda: dataVenda,
        desconto: desconto || "0",
        forma_pagamento: formaPagamento,
        status_pagamento: statusPagamento,
        observacoes,
        itens: itens.map((item) => ({
          produto: item.produto,
          descricao: item.descricao,
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
        })),
      });
      onClose();
    } catch (err) {
      // O motivo real importa aqui: "desconto maior que o subtotal" é
      // acionável, "erro inesperado" não é.
      setErro(getErrorMessage(err));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
      <form
        onSubmit={salvar}
        className="my-8 w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-elevacao-lg"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {venda ? "Editar venda" : "Nova venda"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {erro && (
          <div role="alert" className="mb-4 rounded-lg border border-erro/40 bg-erro/10 px-3 py-2 text-sm text-erro">
            {erro}
          </div>
        )}

        {/* ── Cliente e data ─────────────────────────────────────── */}
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="venda-cliente" className="mb-1.5 block text-sm font-medium text-foreground-suave">
              Cliente
            </label>
            <select
              id="venda-cliente"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              className="w-full rounded-lg border border-border bg-superficie px-3 py-2.5 text-sm text-foreground focus:border-brand-500 focus:outline-none"
            >
              <option value="">Sem cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="venda-data" className="mb-1.5 block text-sm font-medium text-foreground-suave">
              Data
            </label>
            <input
              id="venda-data"
              type="date"
              value={dataVenda}
              onChange={(e) => setDataVenda(e.target.value)}
              className="w-full rounded-lg border border-border bg-superficie px-3 py-2.5 text-sm text-foreground focus:border-brand-500 focus:outline-none"
            />
          </div>
        </div>

        {/* ── Itens ──────────────────────────────────────────────── */}
        <div className="mb-5">
          <h3 className="mb-2 text-sm font-medium text-foreground-suave">Itens</h3>

          <div className="mb-3 flex items-end gap-2">
            <div className="flex-1">
              <ProdutoSelect value={produtoNovo} onChange={setProdutoNovo} />
            </div>
            <button
              type="button"
              onClick={adicionarItem}
              disabled={!produtoNovo}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </button>
          </div>

          {itens.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              Nenhum item ainda. Escolha um produto acima para começar.
            </p>
          ) : (
            <ul className="space-y-2">
              {itens.map((item) => (
                <li
                  key={item.chave}
                  className="rounded-lg border border-border bg-superficie p-3"
                  data-testid="item-venda"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {item.produto_nome}
                    </span>
                    <button
                      type="button"
                      onClick={() => removerItem(item.chave)}
                      className="rounded p-1 text-erro transition-colors hover:bg-red-400/10"
                      aria-label={`Remover ${item.produto_nome}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 items-end gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        Quantidade
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={item.quantidade}
                          onChange={(e) => alterarItem(item.chave, "quantidade", e.target.value)}
                          className="mt-1 w-full rounded border border-border bg-card px-2 py-1.5 text-sm text-foreground focus:border-brand-500 focus:outline-none"
                        />
                      </label>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">
                        Preço unitário
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.preco_unitario}
                          onChange={(e) =>
                            alterarItem(item.chave, "preco_unitario", e.target.value)
                          }
                          className="mt-1 w-full rounded border border-border bg-card px-2 py-1.5 text-sm text-foreground focus:border-brand-500 focus:outline-none"
                        />
                      </label>
                    </div>
                    <p className="pb-1.5 text-right text-sm font-medium text-foreground">
                      {formatCurrency(subtotalDoItem(item))}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Pagamento e totais ─────────────────────────────────── */}
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="venda-forma" className="mb-1.5 block text-sm font-medium text-foreground-suave">
              Forma de pagamento
            </label>
            <select
              id="venda-forma"
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value as FormaPagamento | "")}
              className="w-full rounded-lg border border-border bg-superficie px-3 py-2.5 text-sm text-foreground focus:border-brand-500 focus:outline-none"
            >
              <option value="">Não informada</option>
              {FORMAS_PAGAMENTO.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.rotulo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="venda-status" className="mb-1.5 block text-sm font-medium text-foreground-suave">
              Situação
            </label>
            <select
              id="venda-status"
              value={statusPagamento}
              onChange={(e) => setStatusPagamento(e.target.value as StatusPagamentoVenda)}
              className="w-full rounded-lg border border-border bg-superficie px-3 py-2.5 text-sm text-foreground focus:border-brand-500 focus:outline-none"
            >
              <option value="pago">Pago</option>
              <option value="pendente">Pendente</option>
            </select>
          </div>
        </div>

        <div className="mb-5 rounded-lg border border-border bg-superficie p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground" data-testid="venda-subtotal">
              {formatCurrency(subtotal)}
            </span>
          </div>
          <div className="mb-3 flex items-center justify-between gap-3 text-sm">
            <label htmlFor="venda-desconto" className="text-muted-foreground">
              Desconto
            </label>
            <input
              id="venda-desconto"
              type="number"
              step="0.01"
              min="0"
              value={desconto}
              onChange={(e) => setDesconto(e.target.value)}
              className="w-32 rounded border border-border bg-card px-2 py-1.5 text-right text-sm text-foreground focus:border-brand-500 focus:outline-none"
            />
          </div>
          {!descontoCabe && (
            <p role="alert" className="mb-2 text-xs text-erro">
              O desconto não pode ser maior que o subtotal.
            </p>
          )}
          <div className="flex items-center justify-between border-t border-border pt-3 text-base font-semibold">
            <span className="text-foreground">Total</span>
            <span className="text-foreground" data-testid="venda-total">
              {formatCurrency(total)}
            </span>
          </div>
        </div>

        <div>
          <label htmlFor="venda-obs" className="mb-1.5 block text-sm font-medium text-foreground-suave">
            Observações
          </label>
          <textarea
            id="venda-obs"
            rows={2}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            className="w-full resize-none rounded-lg border border-border bg-superficie px-3 py-2.5 text-sm text-foreground focus:border-brand-500 focus:outline-none"
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground-suave transition-colors hover:bg-superficie-forte"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!podeSalvar}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
            {venda ? "Salvar alterações" : "Registrar venda"}
          </button>
        </div>
      </form>
    </div>
  );
}
