"use client";

import { PERIODOS, type PeriodoAnalytics } from "@/types/dashboard";
import { Button } from "@/components/ui/button";

interface PeriodoSelectorProps {
  value: PeriodoAnalytics;
  onChange: (periodo: PeriodoAnalytics) => void;
}

export function PeriodoSelector({ value, onChange }: PeriodoSelectorProps) {
  return (
    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
      {PERIODOS.map((p) => (
        <Button
          key={p.value}
          variant={value === p.value ? "default" : "ghost"}
          size="sm"
          onClick={() => onChange(p.value)}
          className={`h-7 px-3 text-xs font-medium transition-all ${
            value === p.value
              ? "shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}
