"use client";

import type { CSSProperties } from "react";

interface AchievementPulseRingsProps {
  color?: string;
  ringCount?: number;
  duration?: number;
  finalScale?: number;
  anchor?: "center" | "top-left" | "bottom-right";
  size?: number;
}

export function AchievementPulseRings({
  color = "currentColor",
  ringCount = 2,
  duration = 2.8,
  finalScale = 2.4,
  anchor = "top-left",
  size = 30,
}: AchievementPulseRingsProps) {
  const half = size / 2;
  const positionStyle: CSSProperties =
    anchor === "center"
      ? { top: "50%", left: "50%", marginTop: -half, marginLeft: -half }
      : anchor === "bottom-right"
      ? { bottom: 18, right: 18 }
      : { top: 28, left: 13 };

  return (
    <div
      aria-hidden="true"
      data-tq-decor
      style={{ position: "absolute", pointerEvents: "none", ...positionStyle }}
    >
      {Array.from({ length: ringCount }).map((_, i) => (
        <span
          key={i}
          style={
            {
              position: "absolute",
              inset: 0,
              width: size,
              height: size,
              borderRadius: "50%",
              border: `1.5px solid ${color}`,
              opacity: 0,
              animation: `tq-ring-expand ${duration}s ease-out infinite`,
              animationDelay: `${(i * duration) / ringCount}s`,
              "--tq-final-scale": finalScale,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
