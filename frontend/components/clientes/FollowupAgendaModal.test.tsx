/**
 * Follow-up → Agenda: oferece criar o evento; se já existe, pergunta se quer
 * atualizar; ao criar/atualizar mostra o toast com atalho "Ver na Agenda".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FollowupAgendaModal } from "./FollowupAgendaModal";
import type { ApiError } from "@/types/api";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) },
}));

beforeEach(() => {
  push.mockClear();
  toastSuccess.mockClear();
  toastError.mockClear();
});

describe("FollowupAgendaModal", () => {
  it('pergunta "adicionar à Agenda?" e no "Sim" cria o evento (atualizar=false)', async () => {
    const criarEvento = vi.fn().mockResolvedValue({ criado: true });
    const onClose = vi.fn();
    render(
      <FollowupAgendaModal
        clienteNome="Maria"
        dataFollowup="2026-08-01"
        criarEvento={criarEvento}
        onClose={onClose}
      />
    );
    expect(screen.getByText(/Follow-up com/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sim" }));
    await waitFor(() => expect(criarEvento).toHaveBeenCalledWith(false));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it('"Não agora" fecha sem criar', () => {
    const criarEvento = vi.fn();
    const onClose = vi.fn();
    render(
      <FollowupAgendaModal
        clienteNome="Maria"
        dataFollowup="2026-08-01"
        criarEvento={criarEvento}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Não agora" }));
    expect(criarEvento).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("EVENTO_FOLLOWUP_EXISTE → pergunta se quer atualizar e re-chama com atualizar=true", async () => {
    const erro: ApiError = {
      success: false,
      error: { code: "EVENTO_FOLLOWUP_EXISTE", message: "Já existe", details: {} },
    };
    const criarEvento = vi
      .fn()
      .mockRejectedValueOnce(erro)
      .mockResolvedValueOnce({ criado: false });
    render(
      <FollowupAgendaModal
        clienteNome="Maria"
        dataFollowup="2026-08-01"
        criarEvento={criarEvento}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Sim" }));
    // Aparece a pergunta de atualização
    expect(await screen.findByText(/Já existe um evento de follow-up/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sim, atualizar" }));
    await waitFor(() => expect(criarEvento).toHaveBeenLastCalledWith(true));
  });
});
