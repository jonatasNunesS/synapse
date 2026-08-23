/**
 * A seção de lançamentos — o comportamento que as duas telas compartilham.
 *
 * Antes, o painel do financeiro e o "ver todos" tinham código de exclusão
 * separado, e divergiram: o painel não informava o perfil à tabela, então
 * ela assumia "não é admin" e bloqueava quem tinha direito, com uma mensagem
 * que dizia o contrário do que estava acontecendo (QUEBRA-01 / INC-01).
 *
 * Como agora existe um componente só, estes testes valem para as duas telas
 * — é essa a garantia que substitui a duplicação. Os testes exercitam o
 * componente pelo lado de fora: clicar no botão de excluir um pago tem de
 * abrir o fluxo auditado e mandar o motivo para a API, não apagar direto.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { SecaoLancamentos } from "./SecaoLancamentos";
import type { Categoria, Lancamento } from "@/types/financeiro";

const usuario = { perfil: "admin" as string };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ usuario }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function lanc(status: Lancamento["status"]): Lancamento {
  return {
    id: `l-${status}`,
    tipo: "receita",
    descricao: `Lançamento ${status}`,
    valor: 100,
    categoria: null,
    categoria_nome: null,
    categoria_cor: null,
    data_vencimento: "2026-07-10",
    data_pagamento: status === "pago" ? "2026-07-12" : null,
    status,
    recorrente: false,
    recorrencia: "",
    observacoes: "",
    esta_atrasado: false,
    direcao_emprestimo: null,
    direcao_emprestimo_display: null,
    pessoa_emprestimo: null,
    data_retorno_esperado: null,
    emprestimo_quitado: false,
    emprestimo_perdoado: false,
    data_quitacao: null,
    status_emprestimo: "",
    criado_em: "2026-07-10T10:00:00Z",
    atualizado_em: "2026-07-10T10:00:00Z",
  };
}

const categorias: Categoria[] = [];

function acoesFalsas() {
  return {
    atualizar: vi.fn().mockResolvedValue(lanc("pago")),
    deletar: vi.fn().mockResolvedValue(undefined),
    excluirAuditado: vi.fn().mockResolvedValue(undefined),
    pagar: vi.fn().mockResolvedValue(lanc("pago")),
  };
}

function montar(status: Lancamento["status"], onMutacao?: () => void) {
  const acoes = acoesFalsas();
  render(
    <SecaoLancamentos
      lancamentos={[lanc(status)]}
      loading={false}
      categorias={categorias}
      acoes={acoes}
      onMutacao={onMutacao}
    />
  );
  return acoes;
}

beforeEach(() => {
  usuario.perfil = "admin";
});

describe("Lançamento PAGO — admin", () => {
  it("não mostra a mensagem de bloqueio para quem é admin", () => {
    montar("pago");
    expect(
      screen.queryByTitle("Só administradores podem excluir pagamentos")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTitle("Só administradores podem editar pagamentos")
    ).not.toBeInTheDocument();
  });

  it("excluir abre o fluxo auditado em vez de apagar direto", async () => {
    const acoes = montar("pago");

    fireEvent.click(screen.getByTitle("Excluir pagamento (com auditoria)"));

    // O modal auditado avisa do impacto e pede confirmação; nada foi apagado.
    expect(
      await screen.findByText("Esta exclusão afeta saldos e análises já geradas.")
    ).toBeInTheDocument();
    expect(acoes.deletar).not.toHaveBeenCalled();
    expect(acoes.excluirAuditado).not.toHaveBeenCalled();
  });

  it("só conclui com descrição confirmada e motivo — e manda o motivo", async () => {
    const acoes = montar("pago");

    fireEvent.click(screen.getByTitle("Excluir pagamento (com auditoria)"));

    const botao = (await screen.findByText("Excluir definitivamente")).closest(
      "button"
    )!;
    expect(botao).toBeDisabled(); // nada preenchido ainda

    fireEvent.change(
      screen.getByPlaceholderText("Digite a descrição do lançamento"),
      { target: { value: "Lançamento pago" } }
    );
    fireEvent.change(screen.getByPlaceholderText(/lançamento duplicado/i), {
      target: { value: "Duplicidade no caixa" },
    });
    fireEvent.click(botao);

    await waitFor(() =>
      expect(acoes.excluirAuditado).toHaveBeenCalledWith(
        "l-pago",
        "Duplicidade no caixa"
      )
    );
    // Nunca pela rota sem auditoria.
    expect(acoes.deletar).not.toHaveBeenCalled();
  });

  it("editar abre o fluxo auditado do pago", async () => {
    const acoes = montar("pago");

    fireEvent.click(screen.getByTitle("Editar pagamento (com auditoria)"));

    // O modal auditado é um passo a passo que termina no motivo obrigatório;
    // aqui basta provar que é ele que abre, e que nada foi salvo à revelia.
    expect(await screen.findByText("Editar lançamento pago")).toBeInTheDocument();
    expect(acoes.atualizar).not.toHaveBeenCalled();
  });
});

describe("Lançamento PAGO — não-admin", () => {
  it("vê o bloqueio, e o motivo declarado é o perfil", () => {
    usuario.perfil = "colaborador";
    montar("pago");

    expect(
      screen.getByTitle("Só administradores podem excluir pagamentos")
    ).toBeInTheDocument();
  });

  it("não consegue disparar exclusão nenhuma", () => {
    usuario.perfil = "colaborador";
    const acoes = montar("pago");

    fireEvent.click(
      screen.getByTitle("Só administradores podem excluir pagamentos")
    );

    expect(acoes.deletar).not.toHaveBeenCalled();
    expect(acoes.excluirAuditado).not.toHaveBeenCalled();
  });
});

describe("Lançamento PENDENTE", () => {
  it("segue a confirmação simples, sem exigir motivo", async () => {
    const acoes = montar("pendente");

    fireEvent.click(screen.getByTitle("Excluir lançamento"));

    expect(
      await screen.findByText(/não pode ser desfeita/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(acoes.deletar).toHaveBeenCalledWith("l-pendente"));
    expect(acoes.excluirAuditado).not.toHaveBeenCalled();
  });
});

describe("Contrato com a tela que hospeda a seção", () => {
  it("avisa a página depois de mutar, para ela recarregar o saldo", async () => {
    const onMutacao = vi.fn();
    const acoes = montar("pendente", onMutacao);

    fireEvent.click(screen.getByTitle("Excluir lançamento"));
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(acoes.deletar).toHaveBeenCalled());
    await waitFor(() => expect(onMutacao).toHaveBeenCalled());
  });

  it("funciona sem onMutacao — a prop é opcional", async () => {
    const acoes = montar("pendente");

    fireEvent.click(screen.getByTitle("Excluir lançamento"));
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(acoes.deletar).toHaveBeenCalled());
  });
});
