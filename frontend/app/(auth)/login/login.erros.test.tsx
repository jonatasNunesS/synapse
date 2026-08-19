/**
 * A tela de login mostrando o motivo real da falha.
 *
 * Antes, qualquer erro virava "Ocorreu um erro inesperado." — a pessoa não
 * sabia se tinha errado a senha, se a conta estava suspensa ou se havia
 * batido no limite de tentativas, e portanto não sabia o que fazer.
 *
 * O useAuth extrai a mensagem do backend e a repassa dentro de um Error
 * nativo; é essa forma que a tela recebe, e é ela que os testes reproduzem.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import LoginPage from "./page";

const login = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ login }) }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const GENERICA = "Ocorreu um erro inesperado.";

beforeEach(() => login.mockReset());

async function tentarLogin(email = "alguem@empresa.com", senha = "Senha@12345") {
  render(<LoginPage />);
  fireEvent.change(screen.getByPlaceholderText("seu@email.com"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByPlaceholderText("••••••••"), {
    target: { value: senha },
  });
  fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
}

describe("Login: motivo real da falha", () => {
  it.each([
    ["senha errada", "E-mail ou senha incorretos."],
    ["conta suspensa", "Esta empresa está suspensa e não pode realizar operações."],
    [
      "limite de tentativas",
      "Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.",
    ],
    ["servidor fora", "Erro no servidor, tente novamente."],
  ])("mostra a mensagem do backend — %s", async (_caso, mensagem) => {
    login.mockRejectedValueOnce(new Error(mensagem));

    await tentarLogin();

    expect(await screen.findByText(mensagem)).toBeInTheDocument();
    expect(screen.queryByText(GENERICA)).not.toBeInTheDocument();
  });

  it("ainda cai no texto genérico quando não há mensagem alguma", async () => {
    login.mockRejectedValueOnce({});

    await tentarLogin();

    expect(await screen.findByText(GENERICA)).toBeInTheDocument();
  });
});

describe("Login: enumeração de usuário", () => {
  it("e-mail inexistente e senha errada exibem o MESMO texto", async () => {
    // O backend devolve uma mensagem única para os dois casos. A tela agora
    // a exibe — e continua não revelando qual dos campos falhou.
    const unica = "E-mail ou senha incorretos.";

    /** Faz uma tentativa isolada e devolve o texto que a tela mostrou. */
    async function textoExibido(email: string, senha: string) {
      login.mockRejectedValueOnce(new Error(unica));
      const { unmount } = render(<LoginPage />);
      fireEvent.change(screen.getByPlaceholderText("seu@email.com"), {
        target: { value: email },
      });
      fireEvent.change(screen.getByPlaceholderText("••••••••"), {
        target: { value: senha },
      });
      fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

      const texto = (await screen.findByText(unica)).textContent;
      unmount();
      return texto;
    }

    const contaInexistente = await textoExibido("naoexiste@empresa.com", "Senha@12345");
    const senhaErrada = await textoExibido("existe@empresa.com", "senha-errada");

    expect(contaInexistente).toBe(senhaErrada);
    expect(contaInexistente).toBe(unica);
  });

  it("a mensagem exibida não denuncia se a conta existe", async () => {
    login.mockRejectedValueOnce(new Error("E-mail ou senha incorretos."));

    await tentarLogin();

    const alerta = await screen.findByText(/incorretos/i);
    expect(alerta.textContent).not.toMatch(/não (existe|cadastrad|encontrad)/i);
  });
});

describe("Login: enquanto envia", () => {
  it("desabilita o botão para não disparar duas vezes", async () => {
    let liberar: (() => void) | undefined;
    login.mockImplementationOnce(
      () => new Promise<void>((resolve) => { liberar = resolve; })
    );

    await tentarLogin();

    const botao = screen.getByRole("button", { name: /entrando|entrar/i });
    await waitFor(() => expect(botao).toBeDisabled());

    liberar?.();
  });
});
