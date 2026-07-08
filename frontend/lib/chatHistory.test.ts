/**
 * Testes do histórico local do Chat Financeiro (lógica pura, storage injetável).
 * Cobre: salvar/recuperar após "reload", isolamento por usuário, limite de 10.
 */
import { describe, it, expect } from "vitest";
import {
  MAX_CONVERSAS,
  carregarConversas,
  excluirConversa,
  gerarTitulo,
  salvarConversas,
  storageKey,
  upsertConversa,
  type Conversa,
  type StorageLike,
} from "@/lib/chatHistory";

// Storage falso em memória (imita localStorage).
function fakeStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

function conversa(id: string, titulo: string, t: number): Conversa {
  return {
    id,
    titulo,
    mensagens: [
      { role: "user", content: `pergunta ${id}` },
      { role: "assistant", content: `resposta ${id}` },
    ],
    criadoEm: t,
    atualizadoEm: t,
  };
}

describe("gerarTitulo", () => {
  it("usa as primeiras 40 chars da 1ª pergunta", () => {
    const longa = "Por que meu saldo caiu tanto no mês de julho comparado a junho?";
    const titulo = gerarTitulo(longa);
    expect(titulo.length).toBeLessThanOrEqual(41); // 40 + reticências
    expect(titulo.startsWith("Por que meu saldo caiu")).toBe(true);
  });

  it("dá um título padrão quando a pergunta é vazia", () => {
    expect(gerarTitulo("   ")).toBe("Nova conversa");
  });
});

describe("salvar e recuperar após reload", () => {
  it("persiste e relê a conversa do storage", () => {
    const s = fakeStorage();
    const key = storageKey("user-1", "empresa-1");
    salvarConversas(s, key, [conversa("a", "Sobre o saldo", 100)]);

    // "reload": nova leitura a partir do mesmo storage
    const recuperadas = carregarConversas(s, key);
    expect(recuperadas).toHaveLength(1);
    expect(recuperadas[0].titulo).toBe("Sobre o saldo");
    expect(recuperadas[0].mensagens).toHaveLength(2);
  });

  it("storage vazio ou corrompido retorna lista vazia (não quebra)", () => {
    const s = fakeStorage();
    const key = storageKey("user-1", "empresa-1");
    expect(carregarConversas(s, key)).toEqual([]);
    s.setItem(key, "{lixo não-json");
    expect(carregarConversas(s, key)).toEqual([]);
  });
});

describe("isolamento por usuário e empresa", () => {
  it("dois usuários no mesmo navegador não misturam conversas", () => {
    const s = fakeStorage();
    const kA = storageKey("user-A", "empresa-1");
    const kB = storageKey("user-B", "empresa-1");
    expect(kA).not.toBe(kB);

    salvarConversas(s, kA, [conversa("a", "Conversa do A", 100)]);
    salvarConversas(s, kB, [conversa("b", "Conversa do B", 100)]);

    const doA = carregarConversas(s, kA);
    const doB = carregarConversas(s, kB);
    expect(doA.map((c) => c.titulo)).toEqual(["Conversa do A"]);
    expect(doB.map((c) => c.titulo)).toEqual(["Conversa do B"]);
  });

  it("a mesma pessoa em empresas diferentes também é isolada", () => {
    expect(storageKey("user-1", "empresa-1")).not.toBe(
      storageKey("user-1", "empresa-2")
    );
  });
});

describe("limite de MAX_CONVERSAS", () => {
  it("mantém só as 10 mais recentes; as antigas somem", () => {
    const s = fakeStorage();
    const key = storageKey("user-1", "empresa-1");

    let lista: Conversa[] = [];
    // Insere 12 conversas com timestamps crescentes (via upsert, como no app).
    for (let i = 1; i <= 12; i++) {
      lista = upsertConversa(lista, conversa(`c${i}`, `Conversa ${i}`, i * 100));
    }
    const salvas = salvarConversas(s, key, lista);

    expect(salvas).toHaveLength(MAX_CONVERSAS);
    const ids = salvas.map((c) => c.id);
    // As duas mais antigas (c1, c2) foram descartadas
    expect(ids).not.toContain("c1");
    expect(ids).not.toContain("c2");
    // A mais recente (c12) está no topo
    expect(salvas[0].id).toBe("c12");
  });
});

describe("upsert e exclusão", () => {
  it("atualizar uma conversa existente não duplica", () => {
    let lista = [conversa("a", "Título antigo", 100)];
    lista = upsertConversa(lista, { ...conversa("a", "Título novo", 200) });
    expect(lista).toHaveLength(1);
    expect(lista[0].titulo).toBe("Título novo");
  });

  it("excluir remove pelo id", () => {
    const lista = [conversa("a", "A", 100), conversa("b", "B", 200)];
    const depois = excluirConversa(lista, "a");
    expect(depois.map((c) => c.id)).toEqual(["b"]);
  });
});
