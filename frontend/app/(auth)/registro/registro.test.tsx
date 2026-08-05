/**
 * Cadastro em 3 etapas:
 * 1) Sua conta → 2) Sua empresa → 3) Como você trabalha (as 6 perguntas).
 * As respostas da etapa 3 viram a configuração de módulos da empresa, e não
 * dá para avançar/concluir sem responder.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import RegistroPage from "./page";

const registro = vi.fn().mockResolvedValue(undefined);
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ registro }) }));

/** Responde uma pergunta da etapa 3 clicando no card. */
function responder(pergunta: string, resposta: string) {
  const bloco = screen.getByText(pergunta).closest("div") as HTMLElement;
  fireEvent.click(within(bloco).getByRole("button", { name: resposta }));
}

function preencherEtapa1() {
  fireEvent.change(screen.getByPlaceholderText("João Silva"), {
    target: { value: "Maria Souza" },
  });
  fireEvent.change(screen.getByPlaceholderText("seu@email.com"), {
    target: { value: "maria@padaria.com" },
  });
  fireEvent.change(screen.getByPlaceholderText("Mín. 8 caracteres"), {
    target: { value: "Senha1234" },
  });
  fireEvent.change(screen.getByPlaceholderText("Repita a senha"), {
    target: { value: "Senha1234" },
  });
}

function preencherEtapa2() {
  fireEvent.change(screen.getByPlaceholderText("Minha Empresa LTDA"), {
    target: { value: "Padaria da Maria" },
  });
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "alimentacao" } });
}

beforeEach(() => registro.mockClear());

describe("Cadastro em 3 etapas", () => {
  it("não avança da etapa 1 sem preencher os campos", async () => {
    render(<RegistroPage />);
    expect(screen.getByText("Etapa 1 de 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(await screen.findByText("E-mail inválido.")).toBeInTheDocument();
    expect(screen.getByText("Etapa 1 de 3")).toBeInTheDocument();
    expect(screen.queryByText("Sua empresa")).not.toBeInTheDocument();
  });

  it("não avança da etapa 2 sem nome da empresa e segmento", async () => {
    render(<RegistroPage />);
    preencherEtapa1();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Etapa 2 de 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Selecione um segmento.")).toBeInTheDocument();
    expect(screen.getByText("Etapa 2 de 3")).toBeInTheDocument();
  });

  it("percorre as 3 etapas e as respostas configuram os módulos", async () => {
    render(<RegistroPage />);

    // Etapa 1 → 2
    preencherEtapa1();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Etapa 2 de 3")).toBeInTheDocument();
    expect(screen.getByText("Sua empresa")).toBeInTheDocument();

    // Etapa 2 → 3
    preencherEtapa2();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Etapa 3 de 3")).toBeInTheDocument();
    expect(screen.getByText("Como você trabalha")).toBeInTheDocument();

    // Sem responder tudo, o botão de concluir fica travado
    const concluir = screen.getByRole("button", { name: "Criar conta grátis" });
    expect(concluir).toBeDisabled();
    expect(
      screen.getByText("Responda todas as perguntas para continuar.")
    ).toBeInTheDocument();

    // Responde as 6 perguntas (mistura de sim e não)
    responder("Você controla estoque de produtos físicos?", "Sim");
    responder("Você compra de fornecedores regularmente?", "Não");
    responder("Você trabalha com projetos ou eventos com prazo?", "Não");
    responder("Você precisa de agenda para compromissos e eventos?", "Sim");
    responder("Você tem equipe ou trabalha sozinho?", "Trabalho sozinho");
    responder("Você precisa guardar contratos e documentos?", "Sim");

    await waitFor(() => expect(concluir).not.toBeDisabled());
    fireEvent.click(concluir);

    await waitFor(() => expect(registro).toHaveBeenCalledTimes(1));
    expect(registro).toHaveBeenCalledWith(
      expect.objectContaining({
        nome_usuario: "Maria Souza",
        email: "maria@padaria.com",
        nome_empresa: "Padaria da Maria",
        segmento: "alimentacao",
        modulo_estoque: true,
        modulo_fornecedores: false,
        modulo_projetos: false,
        modulo_agenda: true,
        modulo_equipe: false,
        modulo_documentos: true,
      })
    );
  });

  it("o botão Voltar retorna para a etapa anterior sem perder os dados", async () => {
    render(<RegistroPage />);
    preencherEtapa1();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("Etapa 2 de 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Voltar/ }));
    expect(await screen.findByText("Etapa 1 de 3")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("João Silva")).toHaveValue("Maria Souza");
  });
});
