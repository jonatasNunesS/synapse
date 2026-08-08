"use client";
/**
 * Etapa 3 do cadastro — "Como você trabalha".
 * Cada pergunta liga/desliga um módulo opcional. Todas são obrigatórias:
 * o botão de concluir só habilita quando todas foram respondidas.
 * Visual: dois cards clicáveis por pergunta (nada de select).
 */
import type { ModuloOpcional } from "@/types/auth";

export interface Pergunta {
  modulo: ModuloOpcional;
  pergunta: string;
  sim: string;
  nao: string;
  /** Emoji/ícone só para dar cara de card. */
  icone: string;
}

export const PERGUNTAS: Pergunta[] = [
  {
    modulo: "estoque",
    pergunta: "Você controla estoque de produtos físicos?",
    sim: "Sim",
    nao: "Não",
    icone: "📦",
  },
  {
    modulo: "fornecedores",
    pergunta: "Você compra de fornecedores regularmente?",
    sim: "Sim",
    nao: "Não",
    icone: "🏭",
  },
  {
    modulo: "projetos",
    pergunta: "Você trabalha com projetos ou eventos com prazo?",
    sim: "Sim",
    nao: "Não",
    icone: "📋",
  },
  {
    modulo: "agenda",
    pergunta: "Você precisa de agenda para compromissos e eventos?",
    sim: "Sim",
    nao: "Não",
    icone: "📅",
  },
  {
    modulo: "equipe",
    pergunta: "Você tem equipe ou trabalha sozinho?",
    sim: "Tenho equipe",
    nao: "Trabalho sozinho",
    icone: "👥",
  },
  {
    modulo: "documentos",
    pergunta: "Você precisa guardar contratos e documentos?",
    sim: "Sim",
    nao: "Não",
    icone: "📄",
  },
];

export type RespostasModulos = Partial<Record<ModuloOpcional, boolean>>;

interface Props {
  respostas: RespostasModulos;
  onResponder: (modulo: ModuloOpcional, valor: boolean) => void;
}

export function PerguntasModulos({ respostas, onResponder }: Props) {
  return (
    <div className="space-y-5">
      {PERGUNTAS.map((p) => {
        const resposta = respostas[p.modulo];
        return (
          <div key={p.modulo}>
            <p className="text-sm font-medium text-slate-200 mb-2 flex items-start gap-2">
              <span aria-hidden>{p.icone}</span>
              <span>{p.pergunta}</span>
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {([true, false] as const).map((valor) => {
                const selecionado = resposta === valor;
                return (
                  <button
                    key={String(valor)}
                    type="button"
                    aria-pressed={selecionado}
                    onClick={() => onResponder(p.modulo, valor)}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                      selecionado
                        ? "border-brand-500 bg-brand-600/20 text-white shadow-sm"
                        : "border-slate-700/60 bg-slate-900/60 text-slate-300 hover:border-slate-600 hover:bg-slate-900"
                    }`}
                  >
                    {valor ? p.sim : p.nao}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
