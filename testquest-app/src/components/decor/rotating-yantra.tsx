"use client";

import { useEffect, useRef } from "react";

interface RotatingYantraProps {
  size?: number;
  color?: string;
  className?: string;
}

export function RotatingYantra({
  size = 320,
  color = "var(--primary)",
  className,
}: RotatingYantraProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const SVG_NS = "http://www.w3.org/2000/svg";
    const cx = size / 2;
    const cy = size / 2;

    function el(name: string, attrs: Record<string, string | number>) {
      const e = document.createElementNS(SVG_NS, name);
      for (const k in attrs) e.setAttribute(k, String(attrs[k]));
      return e;
    }

    function polyPts(n: number, r: number, startA = -Math.PI / 2) {
      const pts: string[] = [];
      for (let i = 0; i < n; i++) {
        const a = startA + (i / n) * 2 * Math.PI;
        pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
      }
      return pts.join(" ");
    }

    svg.replaceChildren();
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);

    [size * 0.44, size * 0.34, size * 0.24, size * 0.13, size * 0.056].forEach((r, i) => {
      svg.appendChild(
        el("circle", {
          cx, cy, r,
          fill: "none",
          stroke: color,
          "stroke-opacity": 0.1 + i * 0.02,
          "stroke-width": 0.5,
        })
      );
    });

    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * 2 * Math.PI - Math.PI / 2;
      const inner = size * 0.45;
      const outer = size * 0.47;
      svg.appendChild(
        el("line", {
          x1: cx + inner * Math.cos(a),
          y1: cy + inner * Math.sin(a),
          x2: cx + outer * Math.cos(a),
          y2: cy + outer * Math.sin(a),
          stroke: color,
          "stroke-opacity": 0.16,
          "stroke-width": 0.5,
        })
      );
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Outer dot ring — clockwise 90s
    const outer = el("g", {});
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI / 2 + (i / 12) * 2 * Math.PI;
      outer.appendChild(
        el("circle", {
          cx: cx + size * 0.39 * Math.cos(a),
          cy: cy + size * 0.39 * Math.sin(a),
          r: 2.2,
          fill: color,
          "fill-opacity": 0.45,
        })
      );
    }
    if (!reduced) {
      outer.appendChild(
        el("animateTransform", {
          attributeName: "transform", type: "rotate",
          from: `0 ${cx} ${cy}`, to: `360 ${cx} ${cy}`,
          dur: "90s", repeatCount: "indefinite",
        })
      );
    }
    svg.appendChild(outer);

    // Middle polygons — counter-clockwise 60s
    const mid = el("g", {});
    mid.appendChild(
      el("polygon", { points: polyPts(12, size * 0.3), fill: "none", stroke: color, "stroke-opacity": 0.22, "stroke-width": 0.6 })
    );
    mid.appendChild(
      el("polygon", { points: polyPts(6, size * 0.3), fill: "none", stroke: color, "stroke-opacity": 0.18, "stroke-width": 0.5 })
    );
    if (!reduced) {
      mid.appendChild(
        el("animateTransform", {
          attributeName: "transform", type: "rotate",
          from: `0 ${cx} ${cy}`, to: `-360 ${cx} ${cy}`,
          dur: "60s", repeatCount: "indefinite",
        })
      );
    }
    svg.appendChild(mid);

    // Inner hexagram — clockwise 40s
    const inner = el("g", {});
    inner.appendChild(
      el("polygon", { points: polyPts(3, size * 0.18, -Math.PI / 2), fill: "none", stroke: color, "stroke-opacity": 0.25, "stroke-width": 0.6 })
    );
    inner.appendChild(
      el("polygon", { points: polyPts(3, size * 0.18, Math.PI / 2), fill: "none", stroke: color, "stroke-opacity": 0.25, "stroke-width": 0.6 })
    );
    if (!reduced) {
      inner.appendChild(
        el("animateTransform", {
          attributeName: "transform", type: "rotate",
          from: `0 ${cx} ${cy}`, to: `360 ${cx} ${cy}`,
          dur: "40s", repeatCount: "indefinite",
        })
      );
    }
    svg.appendChild(inner);

    // Central bindu
    svg.appendChild(el("circle", { cx, cy, r: 3, fill: color, "fill-opacity": 0.55 }));
  }, [size, color]);

  return (
    <svg
      ref={svgRef}
      className={className}
      aria-hidden="true"
      data-tq-decor
      style={{ position: "absolute", width: size, height: size, pointerEvents: "none" }}
    />
  );
}
