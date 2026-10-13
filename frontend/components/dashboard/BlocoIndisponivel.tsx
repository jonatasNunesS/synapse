"use client";

/**
 * Synapse — O que um cartão do dashboard mostra quando o dado não veio.
 *
 * Existe porque a alternativa era mostrar zero. Zero é informação: "não vendeu
 * nada hoje" é um fato, e o dono do negócio age em cima dele. Falha na consulta
 * é outra coisa, e exibi-la como zero faz o sistema afirmar com confiança algo
 * que ele não sabe — o pior tipo de erro, porque não parece erro.
 *
 * Fica dentro do cartão, não no lugar da tela: um bloco que falhou não derruba
 * o resto do dashboard.
 */

import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  /** Opcional: "os vencimentos", "o funil". Entra na frase quando existe. */
  oQue?: string;
  /** Quando dado, aparece o botão. Os hooks do dashboard já expõem `refresh`. */
  onTentarNovamente?: () => void;
}

export function BlocoIndisponivel({ oQue, onTentarNovamente }: Props) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-2 py-8 text-center"
    >
      <AlertCircle className="h-5 w-5 text-alerta" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">
        Não foi possível carregar {oQue ?? "estes dados"}.
      </p>
      {/* Deliberadamente não dizemos "tente mais tarde" e paramos aí: sem o
          botão, "mais tarde" significa recarregar a página inteira e perder o
          resto do dashboard, que está funcionando. */}
      {onTentarNovamente && (
        <button
          type="button"
          onClick={onTentarNovamente}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-brand-accent transition-colors hover:bg-brand-400/10"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          Tentar de novo
        </button>
      )}
    </div>
  );
}

/**
 * A versão que cabe num cartão de KPI, onde o espaço é de uma linha de número.
 *
 * Sem ícone e sem botão: são oito cartões lado a lado, e oito avisos com
 * botão viram um muro. O KPI diz "—" e a razão em letra pequena; quem quiser
 * tentar de novo usa o "Atualizar" do cabeçalho, que recarrega os KPIs juntos.
 */
export function KPIIndisponivel() {
  return (
    <>
      <p className="mt-1 text-2xl font-bold text-muted-foreground">—</p>
      <p className="mt-1 text-xs text-alerta">Não foi possível carregar</p>
    </>
  );
}
