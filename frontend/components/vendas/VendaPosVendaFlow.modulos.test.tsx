/**
 * Módulos configuráveis — com o Estoque desligado, a venda recém-registrada
 * não pergunta mais "Baixar do estoque?": vai direto para o financeiro. Com o
 * módulo ligado, o fluxo continua o de sempre.
 *
 * ESTE ARQUIVO MUDOU DE ENDEREÇO. Ele era
 * `components/clientes/NovaInteracaoRapidaModal.modulos.test.tsx` e media o
 * mesmo gating no fluxo que seguia uma INTERAÇÃO do tipo "venda". Esse tipo
 * deixou de ser oferecido: venda se registra na tela de Vendas, e as métricas
 * do cliente leem `Venda` e só ela (B10).
 *
 * A propriedade guardada é a mesma e continua valendo — mudou a tela em que
 * ela vive. `VendaPosVendaFlow` não tinha teste nenhum até aqui, e é
 * exatamente quem decide a primeira pergunta a partir do módulo ativo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { VendaPosVendaFlow } from "./VendaPosVendaFlow";
import { useAppStore } from "@/store/useAppStore";
import type { ModulosEmpresa, Usuario } from "@/types/auth";
import type { Venda } from "@/types/vendas";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { previaEstoque, baixarEstoque, lancarFinanceiro } = vi.hoisted(() => ({
  previaEstoque: vi.fn(),
  baixarEstoque: vi.fn(),
  lancarFinanceiro: vi.fn(),
}));

vi.mock("@/hooks/useVendas", () => ({
  vendaIntegracoes: {
    previaEstoque: (...a: unknown[]) => previaEstoque(...a),
    baixarEstoque: (...a: unknown[]) => baixarEstoque(...a),
    lancarFinanceiro: (...a: unknown[]) => lancarFinanceiro(...a),
  },
}));

function setModulos(modulos: Partial<ModulosEmpresa>) {
  useAppStore.setState({ usuario: { id: "u1", modulos } as unknown as Usuario });
}

function venda(extra: Partial<Venda> = {}): Venda {
  return {
    id: "v-1",
    cliente: "c1",
    cliente_nome: "Padaria da Maria",
    data_venda: "2026-01-10",
    subtotal: "150.00",
    desconto: "0",
    total: "150.00",
    forma_pagamento: "pix",
    status_pagamento: "pago",
    data_prevista_pagamento: null,
    observacoes: "",
    itens: [],
    ja_baixou_estoque: false,
    tem_itens_com_produto: true,
    tem_lancamento_financeiro: false,
    criado_em: "2026-01-10T10:00:00Z",
    atualizado_em: "2026-01-10T10:00:00Z",
    ...extra,
  } as Venda;
}

beforeEach(() => {
  previaEstoque.mockReset();
  previaEstoque.mockResolvedValue({ itens: [], pode_baixar: true });
  baixarEstoque.mockReset();
  lancarFinanceiro.mockReset();
  useAppStore.setState({ usuario: null });
});

describe("Venda × módulo Estoque", () => {
  it("com Estoque DESLIGADO não pergunta pela baixa, vai pro financeiro", async () => {
    setModulos({ estoque: false });
    render(<VendaPosVendaFlow venda={venda()} onFim={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByText("Lançar no financeiro?")).toBeInTheDocument()
    );
    expect(screen.queryByText("Baixar do estoque?")).not.toBeInTheDocument();
    // E nem chega a consultar a prévia de um módulo desligado.
    expect(previaEstoque).not.toHaveBeenCalled();
  });

  it("com Estoque LIGADO o fluxo continua perguntando pela baixa", async () => {
    setModulos({ estoque: true });
    render(<VendaPosVendaFlow venda={venda()} onFim={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByText("Baixar do estoque?")).toBeInTheDocument()
    );
    expect(screen.queryByText("Lançar no financeiro?")).not.toBeInTheDocument();
  });

  it("sem item de produto não pergunta pela baixa, mesmo com o módulo ligado", () => {
    // A guarda da fase 3A, que protege as 22 vendas migradas: venda só de
    // item livre não tem o que baixar.
    setModulos({ estoque: true });
    render(
      <VendaPosVendaFlow
        venda={venda({ tem_itens_com_produto: false })}
        onFim={vi.fn()}
      />
    );

    expect(screen.queryByText("Baixar do estoque?")).not.toBeInTheDocument();
    expect(screen.getByText("Lançar no financeiro?")).toBeInTheDocument();
  });
});
