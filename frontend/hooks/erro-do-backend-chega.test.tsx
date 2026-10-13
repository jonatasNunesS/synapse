/**
 * O erro do backend chega até quem está olhando a tela.
 *
 * ERR-07. As leituras dos hooks de dados tinham `} catch {` sem binding: o
 * erro era descartado ali, e no lugar dele a tela recebia uma frase fixa —
 * "Erro ao carregar produtos." — igual para permissão negada, filtro inválido
 * e banco fora do ar. Quem lia não ficava sabendo de nada.
 *
 * O caminho completo tem três trechos, e cada um foi silencioso em algum
 * momento:
 *
 *   1. o hook captura o erro em vez de descartá-lo
 *   2. o hook propaga, para quem chamou poder reagir
 *   3. quem chamou mostra a mensagem
 *
 * Consertar só o (1) não mudava nada visível, e é importante dizer por quê:
 * o campo `error` destes hooks era escrito e NUNCA renderizado — nenhuma
 * página de Estoque ou CRM o lia. Daí os testes abaixo cobrarem o (2) e o
 * (3), não só o (1).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// `vi.hoisted` porque as chamadas de `vi.mock` sobem para o topo do arquivo:
// um `const` comum ainda não existiria quando a fábrica roda.
const { get, patch, toastError } = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  toastError: vi.fn(),
}));

// `importActual` de propósito: o `getErrorMessage` de verdade é parte do que
// está sendo testado — é ele que tira a mensagem do envelope do backend.
vi.mock("@/lib/api", async () => {
  const real = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...real, api: { get, patch, post: vi.fn(), delete: vi.fn() } };
});

vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }));

import { useProdutos, useResumoEstoque, useCategoriasEstoque } from "./useEstoque";
import { useClientes, useClienteDetalhe, useFunilKanban } from "./useClientes";
import { avisarSeFalhar } from "@/lib/avisarErro";

/** Um envelope de erro no formato que o backend devolve. */
function envelope(code: string, message: string) {
  return { success: false, error: { code, message, details: {} } };
}

const PERMISSAO = envelope(
  "MODULO_INATIVO",
  "O módulo Estoque está desligado para esta empresa."
);

beforeEach(() => {
  get.mockReset();
  patch.mockReset();
  toastError.mockReset();
});

// ════════════════════════════════════════════════════════════
// (1) e (2): o hook guarda a mensagem e propaga
// ════════════════════════════════════════════════════════════

describe("Leituras do Estoque", () => {
  it("o erro vira a mensagem real do backend, não a frase fixa", async () => {
    get.mockRejectedValue(PERMISSAO);
    const { result } = renderHook(() => useResumoEstoque());

    await act(async () => {
      await expect(result.current.carregar()).rejects.toBe(PERMISSAO);
    });

    expect(result.current.error).toBe(
      "O módulo Estoque está desligado para esta empresa."
    );
    // A frase que a tela mostrava antes, para qualquer causa.
    expect(result.current.error).not.toBe("Erro ao carregar resumo do estoque.");
  });

  it("listar produtos propaga, em vez de resolver como se tivesse dado certo", async () => {
    get.mockRejectedValue(envelope("FILTRO_INVALIDO", "Filtro de status inválido."));
    const { result } = renderHook(() => useProdutos());

    await act(async () => {
      await expect(result.current.listar({ busca: "x" })).rejects.toBeTruthy();
    });

    expect(result.current.error).toBe("Filtro de status inválido.");
    // Propagar é o que importa: antes, `await listar()` resolvia normalmente e
    // quem chamou seguia como se a lista estivesse atualizada.
  });

  it("obter um produto distingue 'não existe' de 'não consegui olhar'", async () => {
    const { result } = renderHook(() => useProdutos());

    // 404: o produto não existe. Continua devolvendo null.
    get.mockResolvedValue({ success: true, data: null });
    await act(async () => {
      await expect(result.current.obter("p1")).resolves.toBeNull();
    });

    // Falha: propaga, em vez de devolver o mesmo null do 404 — que é o que
    // mandava o usuário de volta para a lista como se o produto sumisse.
    get.mockRejectedValue(envelope("DB_ERROR", "Tempo esgotado na consulta."));
    await act(async () => {
      await expect(result.current.obter("p1")).rejects.toBeTruthy();
    });
  });

  it("carregar de novo com sucesso limpa o erro anterior", async () => {
    const { result } = renderHook(() => useCategoriasEstoque());

    get.mockRejectedValue(PERMISSAO);
    await act(async () => {
      await result.current.listar().catch(() => {});
    });
    expect(result.current.error).toBeTruthy();

    get.mockResolvedValue({ success: true, data: [] });
    await act(async () => {
      await result.current.listar();
    });
    expect(result.current.error).toBeNull();
  });
});

describe("Leituras do CRM", () => {
  it("listar clientes guarda a mensagem do backend e propaga", async () => {
    get.mockRejectedValue(envelope("PERMISSAO", "Você não tem acesso ao CRM."));
    const { result } = renderHook(() => useClientes());

    await act(async () => {
      await expect(result.current.carregar()).rejects.toBeTruthy();
    });

    expect(result.current.error).toBe("Você não tem acesso ao CRM.");
    expect(result.current.error).not.toBe("Erro ao carregar clientes.");
  });

  it("o detalhe do cliente também", async () => {
    get.mockRejectedValue(envelope("NAO_ENCONTRADO", "Cliente não encontrado."));
    const { result } = renderHook(() => useClienteDetalhe("c1"));

    await act(async () => {
      await expect(result.current.carregar()).rejects.toBeTruthy();
    });

    expect(result.current.error).toBe("Cliente não encontrado.");
  });

  it("o funil também", async () => {
    get.mockRejectedValue(envelope("DB_ERROR", "Banco indisponível."));
    const { result } = renderHook(() => useFunilKanban());

    await act(async () => {
      await expect(result.current.carregar()).rejects.toBeTruthy();
    });

    expect(result.current.error).toBe("Banco indisponível.");
  });

  it("arrastar um card que o backend recusa diz POR QUE voltou", async () => {
    get.mockResolvedValue({
      success: true,
      data: { lead: [{ id: "c1", nome: "Ana", status_funil: "lead" }], proposta: [] },
    });
    const { result } = renderHook(() => useFunilKanban());
    await act(async () => {
      await result.current.carregar();
    });

    patch.mockRejectedValue(
      envelope("TRANSICAO_INVALIDA", "Lead não pode ir direto para Fechado.")
    );
    await act(async () => {
      await expect(result.current.moverCard("c1", "proposta")).rejects.toBeTruthy();
    });

    // O card volta para a origem — isso sempre esteve certo. O que faltava
    // era a razão: antes ele pulava de volta sozinho, sem mensagem nenhuma.
    expect(result.current.funil?.lead).toHaveLength(1);
    expect(result.current.error).toBe("Lead não pode ir direto para Fechado.");
  });
});

// ════════════════════════════════════════════════════════════
// (3): quem chamou mostra a mensagem
// ════════════════════════════════════════════════════════════

describe("avisarSeFalhar — o elo que faz a mensagem aparecer", () => {
  it("mostra a mensagem do backend num toast", async () => {
    await avisarSeFalhar(Promise.reject(PERMISSAO));

    expect(toastError).toHaveBeenCalledWith(
      "O módulo Estoque está desligado para esta empresa.",
      { duration: 7000 }
    );
  });

  it("não rejeita — é o que a torna segura dentro de um efeito", async () => {
    // Sem isto, um `useEffect(() => { listar(); })` com o hook propagando
    // viraria "Uncaught (in promise)" num console que o usuário não abre.
    await expect(avisarSeFalhar(Promise.reject(PERMISSAO))).resolves.toBeUndefined();
  });

  it("no caminho feliz não avisa nada e devolve o valor", async () => {
    await expect(avisarSeFalhar(Promise.resolve(42))).resolves.toBe(42);
    expect(toastError).not.toHaveBeenCalled();
  });
});
