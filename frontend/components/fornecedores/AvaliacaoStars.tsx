"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface AvaliacaoStarsProps {
  value: number | null;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

const sizeMap = {
  sm: "h-3.5 w-3.5",
  md: "h-5 w-5",
  lg: "h-7 w-7",
};

export function AvaliacaoStars({
  value,
  onChange,
  readonly = false,
  size = "md",
  label,
  className,
}: AvaliacaoStarsProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const iconSize = sizeMap[size];
  const current = hovered ?? value ?? 0;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && (
        <span className="text-xs text-zinc-400">{label}</span>
      )}
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => !readonly && setHovered(star)}
            onMouseLeave={() => !readonly && setHovered(null)}
            className={cn(
              "transition-transform",
              !readonly && "cursor-pointer hover:scale-110",
              readonly && "cursor-default"
            )}
          >
            <Star
              className={cn(
                iconSize,
                "transition-colors duration-150",
                star <= current
                  ? "fill-amber-400 text-amber-400"
                  : "fill-transparent text-zinc-600"
              )}
            />
          </button>
        ))}
        {value !== null && value !== undefined && (
          <span className="ml-1.5 text-xs text-zinc-400">
            {value.toFixed(1)}
          </span>
        )}
      </div>
    </div>
  );
}

// Componente de avaliação tripla (qualidade / prazo / preço)
interface AvaliacaoTriplaProps {
  qualidade: number | null;
  prazo: number | null;
  preco: number | null;
  readonly?: boolean;
  onChangeQualidade?: (v: number) => void;
  onChangePrazo?: (v: number) => void;
  onChangePreco?: (v: number) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function AvaliacaoTripla({
  qualidade,
  prazo,
  preco,
  readonly = true,
  onChangeQualidade,
  onChangePrazo,
  onChangePreco,
  size = "sm",
  className,
}: AvaliacaoTriplaProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <AvaliacaoStars
        value={qualidade}
        onChange={onChangeQualidade}
        readonly={readonly}
        size={size}
        label="Qualidade"
      />
      <AvaliacaoStars
        value={prazo}
        onChange={onChangePrazo}
        readonly={readonly}
        size={size}
        label="Prazo"
      />
      <AvaliacaoStars
        value={preco}
        onChange={onChangePreco}
        readonly={readonly}
        size={size}
        label="Preço"
      />
    </div>
  );
}
