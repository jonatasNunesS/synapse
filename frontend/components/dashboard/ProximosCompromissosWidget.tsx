"use client";
/**
 * Próximos compromissos — a agenda aparecendo onde a pessoa já olha.
 *
 * Até aqui o dashboard não sabia que a agenda existia: o compromisso marcado
 * só existia para quem fosse até a tela da Agenda procurar. Este bloco fica
 * logo abaixo dos KPIs, porque "o que eu tenho hoje" é a primeira pergunta de
 * quem abre o sistema de manhã.
 *
 * Ocupa a largura inteira de propósito: uma tira de linhas curtas lê melhor
 * do que um cartão estreito com o título truncado.
 */
import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { CompromissoItem } from "@/types/dashboard";

interface Props {
  compromissos: CompromissoItem[];
  isLoading: boolean;
}

/** Quantos cabem sem virar lista longa dentro do dashboard. */
const MAXIMO_VISIVEL = 5;

/** "Hoje" / "Amanhã" / "12/10" — o que a pessoa lê primeiro. */
export function rotuloDia(item: CompromissoItem): string {
  if (item.dias_restantes <= 0) return "Hoje";
  if (item.dias_restantes === 1) return "Amanhã";
  const d = new Date(item.data_inicio);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** A hora, ou "Dia inteiro" quando não há hora que signifique algo. */
export function rotuloHora(item: CompromissoItem): string {
  if (item.dia_inteiro) return "Dia inteiro";
  const d = new Date(item.data_inicio);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function ProximosCompromissosWidget({ compromissos, isLoading }: Props) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="widget-proximos-compromissos">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-brand-500" />
            Próximos Compromissos
          </CardTitle>
          <Link
            href="/agenda"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            Ver agenda <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {compromissos.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm">
            Nenhum compromisso próximo.
          </div>
        ) : (
          <div className="space-y-2">
            {compromissos.slice(0, MAXIMO_VISIVEL).map((c) => (
              <Link
                key={c.id}
                href="/agenda"
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted transition-colors group"
              >
                {/* A cor do evento, que é como a pessoa o reconhece no mês */}
                <span
                  aria-hidden
                  className="h-8 w-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: c.cor }}
                />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-foreground">
                    {c.titulo}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    {c.cliente_nome && (
                      <span className="truncate">{c.cliente_nome}</span>
                    )}
                    {c.local && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        {c.local}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <p
                    className={`text-sm font-medium ${
                      c.dias_restantes <= 0
                        ? "text-erro"
                        : c.dias_restantes === 1
                          ? "text-alerta"
                          : "text-foreground"
                    }`}
                  >
                    {rotuloDia(c)}
                  </p>
                  <p className="text-xs text-muted-foreground">{rotuloHora(c)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
