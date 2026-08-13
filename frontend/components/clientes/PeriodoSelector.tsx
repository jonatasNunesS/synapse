"use client";
/**
 * Seletor de período (Mês + Ano) para filtrar o CRM. Ambos precisam estar
 * preenchidos para o filtro valer. "Limpar" volta ao comportamento sem filtro.
 */
import { CalendarRange, X } from "lucide-react";

export interface Periodo {
  mes: number;
  ano: number;
}

interface Props {
  periodo: Periodo | null;
  onChange: (p: Periodo | null) => void;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function PeriodoSelector({ periodo, onChange }: Props) {
  const anoAtual = new Date().getFullYear();
  const anos = Array.from({ length: 6 }, (_, i) => anoAtual - 4 + i); // 5 anos atrás → próximo

  const mes = periodo?.mes ?? 0;
  const ano = periodo?.ano ?? 0;

  const aplicar = (novoMes: number, novoAno: number) => {
    if (novoMes && novoAno) onChange({ mes: novoMes, ano: novoAno });
    else onChange(null);
  };

  return (
    <div className="flex items-center gap-2">
      <CalendarRange className="w-4 h-4 text-muted-suave flex-shrink-0" />
      <select
        aria-label="Mês"
        value={mes || ""}
        onChange={(e) => aplicar(Number(e.target.value), ano || anoAtual)}
        className="rounded-lg border border-border bg-superficie px-2.5 py-2 text-sm text-foreground focus:outline-none focus:border-brand-500/50"
      >
        <option value="">Mês</option>
        {MESES.map((m, i) => (
          <option key={i} value={i + 1}>
            {m}
          </option>
        ))}
      </select>
      <select
        aria-label="Ano"
        value={ano || ""}
        onChange={(e) => aplicar(mes || new Date().getMonth() + 1, Number(e.target.value))}
        className="rounded-lg border border-border bg-superficie px-2.5 py-2 text-sm text-foreground focus:outline-none focus:border-brand-500/50"
      >
        <option value="">Ano</option>
        {anos.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
      {periodo && (
        <button
          onClick={() => onChange(null)}
          className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs text-foreground-suave hover:bg-superficie-forte transition-colors"
          title="Limpar filtro de período"
        >
          <X className="w-3.5 h-3.5" />
          Limpar
        </button>
      )}
    </div>
  );
}
