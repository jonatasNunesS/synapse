"use client";

import { cn } from "@/lib/utils";

interface ScoreSynapseProps {
  score: number | string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  showBar?: boolean;
  className?: string;
}

function getScoreColor(score: number): {
  text: string;
  bg: string;
  bar: string;
  label: string;
} {
  if (score >= 80)
    return {
      text: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/30",
      bar: "bg-emerald-500",
      label: "Excelente",
    };
  if (score >= 60)
    return {
      text: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/30",
      bar: "bg-blue-500",
      label: "Bom",
    };
  if (score >= 40)
    return {
      text: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/30",
      bar: "bg-amber-500",
      label: "Regular",
    };
  if (score >= 20)
    return {
      text: "text-orange-400",
      bg: "bg-orange-500/10 border-orange-500/30",
      bar: "bg-orange-500",
      label: "Fraco",
    };
  return {
    text: "text-red-400",
    bg: "bg-red-500/10 border-red-500/30",
    bar: "bg-red-500",
    label: "Crítico",
  };
}

const sizeMap = {
  sm: { text: "text-sm font-semibold", container: "px-2 py-0.5 text-xs" },
  md: { text: "text-xl font-bold", container: "px-3 py-1 text-sm" },
  lg: { text: "text-4xl font-black", container: "px-4 py-2 text-base" },
};

export function ScoreSynapse({
  score,
  size = "md",
  showLabel = true,
  showBar = false,
  className,
}: ScoreSynapseProps) {
  const numScore = typeof score === "string" ? parseFloat(score) : score;
  const safeScore = isNaN(numScore) ? 0 : Math.min(100, Math.max(0, numScore));
  const colors = getScoreColor(safeScore);
  const sizes = sizeMap[size];

  if (showBar) {
    return (
      <div className={cn("w-full", className)}>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs text-zinc-400">Score Synapse</span>
          <span className={cn("font-bold", colors.text, sizes.text)}>
            {safeScore.toFixed(0)}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={cn("h-full rounded-full transition-all duration-500", colors.bar)}
            style={{ width: `${safeScore}%` }}
          />
        </div>
        {showLabel && (
          <p className={cn("mt-1 text-right text-xs", colors.text)}>
            {colors.label}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border",
        colors.bg,
        sizes.container,
        className
      )}
    >
      <span className={cn("font-mono font-bold", colors.text, sizes.text)}>
        {safeScore.toFixed(0)}
      </span>
      {showLabel && (
        <span className={cn("text-xs", colors.text)}>{colors.label}</span>
      )}
    </div>
  );
}

// Versão grande para página de detalhe
export function ScoreSynapseCard({
  score,
  className,
}: {
  score: number | string;
  className?: string;
}) {
  const numScore = typeof score === "string" ? parseFloat(score) : score;
  const safeScore = isNaN(numScore) ? 0 : Math.min(100, Math.max(0, numScore));
  const colors = getScoreColor(safeScore);

  // Calcular ângulo para o arco SVG (de -135° a +135°, total 270°)
  const angle = (safeScore / 100) * 270 - 135;
  const rad = (angle * Math.PI) / 180;
  const cx = 60;
  const cy = 60;
  const r = 48;
  const x = cx + r * Math.cos(rad);
  const y = cy + r * Math.sin(rad);

  // Arco de fundo e progresso
  const startAngle = -135;
  const endAngle = startAngle + (safeScore / 100) * 270;
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const largeArc = (safeScore / 100) * 270 > 180 ? 1 : 0;

  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border p-6",
        colors.bg,
        className
      )}
    >
      <p className="mb-3 text-sm font-medium text-zinc-400">Score Synapse</p>
      <svg width="120" height="120" viewBox="0 0 120 120">
        {/* Arco de fundo */}
        <path
          d={`M ${cx + r * Math.cos((-135 * Math.PI) / 180)} ${
            cy + r * Math.sin((-135 * Math.PI) / 180)
          } A ${r} ${r} 0 1 1 ${cx + r * Math.cos((135 * Math.PI) / 180)} ${
            cy + r * Math.sin((135 * Math.PI) / 180)
          }`}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Arco de progresso */}
        {safeScore > 0 && (
          <path
            d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
            fill="none"
            className={cn(
              "transition-all duration-700",
              colors.bar.replace("bg-", "stroke-")
            )}
            strokeWidth="8"
            strokeLinecap="round"
          />
        )}
        {/* Valor central */}
        <text
          x={cx}
          y={cy + 6}
          textAnchor="middle"
          className={cn("text-2xl font-black", colors.text)}
          fill="currentColor"
          fontSize="22"
          fontWeight="900"
        >
          {safeScore.toFixed(0)}
        </text>
        {/* Indicador */}
        <circle cx={x} cy={y} r="5" fill="white" opacity="0.9" />
      </svg>
      <span className={cn("mt-1 text-sm font-semibold", colors.text)}>
        {colors.label}
      </span>
    </div>
  );
}
