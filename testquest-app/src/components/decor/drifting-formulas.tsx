"use client";

import type { CSSProperties } from "react";

interface FormulaSpec {
  text: string;
  size: number;
  xPct: number;
  yPct: number;
  duration: number;
  delay: number;
}

interface DriftingFormulasProps {
  formulas?: FormulaSpec[];
  opacity?: number;
}

const DEFAULT_FORMULAS: FormulaSpec[] = [
  { text: "∫",     size: 30, xPct: 7,  yPct: 8,  duration: 55, delay: -2  },
  { text: "√x",    size: 22, xPct: 33, yPct: 16, duration: 48, delay: -20 },
  { text: "π",     size: 32, xPct: 60, yPct: 6,  duration: 62, delay: -8  },
  { text: "Σ",     size: 26, xPct: 79, yPct: 20, duration: 51, delay: -34 },
  { text: "½",     size: 22, xPct: 10, yPct: 41, duration: 44, delay: -12 },
  { text: "θ",     size: 24, xPct: 47, yPct: 45, duration: 58, delay: -28 },
  { text: "H₂O",   size: 20, xPct: 70, yPct: 38, duration: 60, delay: -5  },
  { text: "sin θ", size: 18, xPct: 21, yPct: 68, duration: 47, delay: -18 },
  { text: "cos²",  size: 18, xPct: 60, yPct: 72, duration: 53, delay: -40 },
  { text: "E=mc²", size: 20, xPct: 82, yPct: 61, duration: 65, delay: -22 },
  { text: "१",     size: 26, xPct: 4,  yPct: 83, duration: 50, delay: -30 },
  { text: "३",     size: 24, xPct: 41, yPct: 85, duration: 54, delay: -10 },
  { text: "५",     size: 22, xPct: 73, yPct: 83, duration: 49, delay: -45 },
  { text: "२",     size: 28, xPct: 89, yPct: 76, duration: 58, delay: -3  },
];

export function DriftingFormulas({
  formulas = DEFAULT_FORMULAS,
  opacity = 0.08,
}: DriftingFormulasProps) {
  return (
    <div
      aria-hidden="true"
      data-tq-decor
      style={
        {
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 0,
          "--tq-formula-op": opacity,
        } as CSSProperties
      }
    >
      {formulas.map((f, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: `${f.xPct}%`,
            top: `${f.yPct}%`,
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: f.size,
            color: "var(--foreground)",
            whiteSpace: "nowrap",
            opacity: 0,
            animation: `tq-formula-drift ${f.duration}s linear ${f.delay}s infinite`,
          }}
        >
          {f.text}
        </span>
      ))}
    </div>
  );
}
