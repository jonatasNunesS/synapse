"use client";
/**
 * Badge de créditos no header do AI Hub: "X / Y hoje · renova em...".
 * Vermelho quando zera; "ilimitado" para enterprise.
 */
import { Coins, Sparkles } from "lucide-react";
import { useCreditos } from "@/hooks/useCreditos";
import { UpgradeWhatsappButton } from "@/components/ui/UpgradeWhatsappButton";

export function CreditosBadge() {
  const { creditos } = useCreditos();
  if (!creditos) return null;

  if (creditos.ilimitado) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-sm text-foreground">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="font-medium">Créditos ilimitados</span>
        <span className="text-muted-foreground">· plano {creditos.plano}</span>
      </div>
    );
  }

  const restante = creditos.restante ?? 0;
  const zerado = restante <= 0;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm ${
        zerado
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-border bg-card text-foreground"
      }`}
      title={`Plano ${creditos.plano}`}
    >
      <Coins className={`h-4 w-4 ${zerado ? "text-destructive" : "text-primary"}`} />
      {zerado ? (
        <span className="font-medium">Sem créditos hoje</span>
      ) : (
        <span className="font-medium">
          {restante} / {creditos.limite} créditos hoje
        </span>
      )}
      <span className={zerado ? "" : "text-muted-foreground"}>
        · renova {creditos.renova_em}
      </span>
      {zerado && <UpgradeWhatsappButton label="Upgrade" size="sm" className="ml-1" />}
    </div>
  );
}
