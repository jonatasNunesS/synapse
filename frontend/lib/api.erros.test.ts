/**
 * A mensagem de erro que chega até a pessoa.
 *
 * O login e o cadastro mostravam "Ocorreu um erro inesperado." para tudo —
 * senha errada, e-mail já cadastrado, limite de tentativas. A mensagem certa
 * vinha do backend e era extraída corretamente pelo useAuth, que a
 * reembrulhava num Error nativo; a tela então chamava getErrorMessage de
 * novo, e a função só sabia ler o envelope da API. O texto real morria ali
 * (QUEBRA-03 do QUALITY_AUDIT.md).
 *
 * Daí a propriedade central destes testes: a função é IDEMPOTENTE — passar
 * o erro por ela duas vezes devolve a mesma mensagem.
 */
import { describe, it, expect } from "vitest";

import { getErrorMessage } from "./api";

/** Monta um envelope de erro no formato que o backend devolve. */
function envelope(code: string, message: string, details: object = {}) {
  return { success: false, error: { code, message, details } };
}

describe("getErrorMessage", () => {
  it("lê a mensagem do envelope da API", () => {
    const erro = envelope("CREDENCIAIS_INVALIDAS", "E-mail ou senha incorretos.");
    expect(getErrorMessage(erro)).toBe("E-mail ou senha incorretos.");
  });

  it("lê a mensagem de um Error nativo", () => {
    expect(getErrorMessage(new Error("E-mail já cadastrado."))).toBe(
      "E-mail já cadastrado."
    );
  });

  it("é idempotente: passar duas vezes não degrada a mensagem", () => {
    const original = envelope("EMAIL_DUPLICADO", "Este e-mail já está cadastrado.");

    const primeira = getErrorMessage(original);
    // É exatamente o que o useAuth faz antes de repassar para a tela.
    const segunda = getErrorMessage(new Error(primeira));

    expect(segunda).toBe("Este e-mail já está cadastrado.");
    expect(segunda).toBe(primeira);
  });

  it("o envelope tem precedência sobre a mensagem do Error", () => {
    // Um objeto que é as duas coisas: a mensagem de negócio é a que vale.
    const hibrido = Object.assign(new Error("técnico e inútil"), {
      error: { code: "X", message: "mensagem de negócio", details: {} },
    });
    expect(getErrorMessage(hibrido)).toBe("mensagem de negócio");
  });

  it("cai no texto genérico só quando não há mensagem nenhuma", () => {
    expect(getErrorMessage(undefined)).toBe("Ocorreu um erro inesperado.");
    expect(getErrorMessage(null)).toBe("Ocorreu um erro inesperado.");
    expect(getErrorMessage({})).toBe("Ocorreu um erro inesperado.");
    expect(getErrorMessage(new Error(""))).toBe("Ocorreu um erro inesperado.");
  });
});

describe("Mensagens que a pessoa passa a ver", () => {
  it.each([
    [
      "senha errada no login",
      envelope("CREDENCIAIS_INVALIDAS", "E-mail ou senha incorretos."),
      "E-mail ou senha incorretos.",
    ],
    [
      "e-mail já cadastrado",
      envelope("EMAIL_DUPLICADO", "Este e-mail já está cadastrado."),
      "Este e-mail já está cadastrado.",
    ],
    [
      "senha fraca",
      envelope("VALIDATION_ERROR", "A senha deve ter ao menos 8 caracteres."),
      "A senha deve ter ao menos 8 caracteres.",
    ],
    [
      "limite de tentativas",
      envelope(
        "RATE_LIMIT_EXCEDIDO",
        "Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.",
        { retry_after_segundos: 900 }
      ),
      "Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.",
    ],
    [
      "servidor sem corpo JSON",
      envelope("ERRO_SERVIDOR", "Erro no servidor, tente novamente.", { status: 502 }),
      "Erro no servidor, tente novamente.",
    ],
    [
      "rede fora do ar",
      envelope(
        "ERRO_REDE",
        "Não foi possível falar com o servidor. Verifique sua conexão e tente novamente."
      ),
      "Não foi possível falar com o servidor. Verifique sua conexão e tente novamente.",
    ],
  ])("%s", (_caso, erro, esperado) => {
    // Direto e depois de passar pelo useAuth: as duas rotas mostram o mesmo.
    expect(getErrorMessage(erro)).toBe(esperado);
    expect(getErrorMessage(new Error(getErrorMessage(erro)))).toBe(esperado);
  });

  it("nenhuma delas é o texto genérico", () => {
    const casos = [
      envelope("CREDENCIAIS_INVALIDAS", "E-mail ou senha incorretos."),
      envelope("EMAIL_DUPLICADO", "Este e-mail já está cadastrado."),
      envelope("RATE_LIMIT_EXCEDIDO", "Muitas tentativas em pouco tempo."),
      envelope("ERRO_SERVIDOR", "Erro no servidor, tente novamente."),
    ];
    for (const c of casos) {
      expect(getErrorMessage(c)).not.toBe("Ocorreu um erro inesperado.");
    }
  });
});

describe("Enumeração de usuário no login", () => {
  it("e-mail inexistente e senha errada dão a MESMA mensagem", () => {
    // O backend devolve um texto único de propósito, para não revelar se a
    // conta existe. A correção só exibe esse texto — não o diferencia.
    const emailNaoExiste = envelope(
      "CREDENCIAIS_INVALIDAS",
      "E-mail ou senha incorretos."
    );
    const senhaErrada = envelope(
      "CREDENCIAIS_INVALIDAS",
      "E-mail ou senha incorretos."
    );

    expect(getErrorMessage(emailNaoExiste)).toBe(getErrorMessage(senhaErrada));
  });

  it("a mensagem não diz qual dos dois campos falhou", () => {
    const msg = getErrorMessage(
      envelope("CREDENCIAIS_INVALIDAS", "E-mail ou senha incorretos.")
    );
    expect(msg).not.toMatch(/não (existe|encontrad|cadastrad)/i);
    expect(msg).not.toMatch(/senha (incorreta|inválida)$/i);
    expect(msg).toMatch(/ou/i); // "e-mail OU senha" — a ambiguidade é o ponto
  });
});
