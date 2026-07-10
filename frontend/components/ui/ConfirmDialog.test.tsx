/**
 * Testes do ConfirmDialog — o coração dos deletes com confirmação.
 * Cobre: não renderiza fechado; Cancelar dispara onCancel (não deleta);
 * Confirmar dispara onConfirm; e — enquanto processa — os botões ficam
 * desabilitados (guarda contra duplo clique / requisição duplicada).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "./ConfirmDialog";

const base = {
  titulo: "Excluir lançamento",
  mensagem: "Tem certeza?",
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe("ConfirmDialog", () => {
  it("não renderiza nada quando open=false", () => {
    render(<ConfirmDialog {...base} open={false} />);
    expect(screen.queryByText("Excluir lançamento")).not.toBeInTheDocument();
  });

  it("renderiza título e mensagem quando open", () => {
    render(<ConfirmDialog {...base} open />);
    expect(screen.getByText("Excluir lançamento")).toBeInTheDocument();
    expect(screen.getByText("Tem certeza?")).toBeInTheDocument();
  });

  it("clicar em Cancelar dispara onCancel e NÃO dispara onConfirm (não deleta)", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog {...base} open onConfirm={onConfirm} onCancel={onCancel} cancelLabel="Cancelar" />
    );
    fireEvent.click(screen.getByText("Cancelar"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("clicar em Confirmar dispara onConfirm", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog {...base} open onConfirm={onConfirm} confirmLabel="Excluir" />
    );
    fireEvent.click(screen.getByText("Excluir"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("enquanto processando, o botão de confirmar fica desabilitado (anti duplo clique)", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        {...base}
        open
        processando
        onConfirm={onConfirm}
        confirmLabel="Excluir"
      />
    );
    const btn = screen.getByRole("button", { name: /Excluir/i });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onConfirm).not.toHaveBeenCalled(); // cliques repetidos não passam
  });

  it("enquanto processando, Cancelar também fica desabilitado", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog {...base} open processando onCancel={onCancel} cancelLabel="Cancelar" />
    );
    const btn = screen.getByRole("button", { name: "Cancelar" });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
