"use client";
/**
 * Synapse — Agenda: legenda das cores.
 *
 * O problema que isto resolve: antes as cores eram dez opções mudas, e duas
 * semanas depois ninguém lembrava por que um compromisso era laranja. A
 * legenda faz laranja ter nome.
 *
 * Regra da legenda: ela precisa explicar TODA cor que está na tela.
 *   • as categorias ativas da empresa (o vocabulário, mesmo sem evento agora);
 *   • as categorias de eventos visíveis, inclusive as DESATIVADAS — uma cor
 *     na tela sem nome na legenda seria exatamente o bug de origem;
 *   • "Sem categoria", só quando há evento visível sem categoria — é a cor
 *     antiga dos eventos de antes desta mudança.
 */
import type { CategoriaEvento, Evento } from "@/types/agenda";

export interface ItemLegenda {
  chave: string;
  nome: string;
  cor: string;
  /** Categoria desligada que ainda pinta evento visível: a legenda avisa. */
  inativa?: boolean;
}

export const CHAVE_SEM_CATEGORIA = "__sem_categoria__";

/**
 * Monta os itens da legenda. Exportada para teste: é aqui que mora a regra de
 * "toda cor da tela tem nome".
 */
export function montarLegenda(
  categorias: CategoriaEvento[],
  eventos: Evento[]
): ItemLegenda[] {
  const itens: ItemLegenda[] = [];
  const vistas = new Set<string>();

  for (const cat of categorias) {
    if (!cat.ativo) continue;
    itens.push({ chave: cat.id, nome: cat.nome, cor: cat.cor });
    vistas.add(cat.id);
  }

  let temSemCategoria = false;
  for (const evento of eventos) {
    if (!evento.categoria) {
      temSemCategoria = true;
      continue;
    }
    if (vistas.has(evento.categoria)) continue;
    vistas.add(evento.categoria);
    // Categoria desativada (ou fora da lista ativa) que ainda pinta esta tela:
    // o nome e a cor vêm do próprio evento, que o backend já resolveu.
    itens.push({
      chave: evento.categoria,
      nome: evento.categoria_nome ?? "Categoria desativada",
      cor: evento.cor_efetiva,
      inativa: true,
    });
  }

  if (temSemCategoria) {
    itens.push({
      chave: CHAVE_SEM_CATEGORIA,
      nome: "Sem categoria",
      // Eventos sem categoria podem ter cores antigas diferentes entre si, então
      // a bolinha aqui é neutra: o recado é "estes não foram classificados".
      cor: "transparent",
    });
  }

  return itens;
}

interface LegendaCategoriasProps {
  categorias: CategoriaEvento[];
  eventos: Evento[];
}

export function LegendaCategorias({ categorias, eventos }: LegendaCategoriasProps) {
  const itens = montarLegenda(categorias, eventos);
  if (itens.length === 0) return null;

  return (
    <div
      data-testid="legenda-categorias"
      className="flex flex-wrap items-center gap-x-4 gap-y-2"
      aria-label="Legenda de categorias"
    >
      {itens.map((item) => (
        <span
          key={item.chave}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span
            data-testid={`legenda-cor-${item.chave}`}
            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              item.cor === "transparent" ? "border border-dashed border-border" : ""
            }`}
            style={{ backgroundColor: item.cor }}
          />
          {item.nome}
          {item.inativa && (
            <span className="text-muted-suave">(desativada)</span>
          )}
        </span>
      ))}
    </div>
  );
}
