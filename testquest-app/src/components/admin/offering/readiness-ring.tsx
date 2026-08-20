"use client";

import { cn } from "@/lib/utils";

/**
 * Progress ring for an offering's readiness — the "N left" counter that keeps
 * momentum visible while the content team works. Turns green at 100%.
 */
export function ReadinessRing({
  done,
  total,
  size = 56,
}: {
  done: number;
  total: number;
  size?: number;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const complete = done >= total && total > 0;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct / 100);

  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <p className={cn("text-sm font-medium", complete && "text-green-600 dark:text-green-500")}>
          {complete ? "Ready" : `${total - done} left`}
        </p>
        <p className="text-xs text-muted-foreground">
          {done} of {total} set up
        </p>
      </div>
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${pct}% ready`}>
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke="currentColor" strokeWidth={stroke}
            className="text-muted-foreground/15"
          />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            className={cn(
              "transition-[stroke-dashoffset] duration-500",
              complete ? "text-green-600 dark:text-green-500" : "text-primary",
            )}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-medium tabular-nums">
          {pct}%
        </span>
      </div>
    </div>
  );
}
