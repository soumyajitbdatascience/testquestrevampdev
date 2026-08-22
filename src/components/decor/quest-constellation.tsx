"use client";

import { useEffect, useRef } from "react";

interface QuestConstellationProps {
  nodeCount?: number;
  maxEdgeDistance?: number;
  pulseCount?: number;
  minNodeSpacing?: number;
  className?: string;
}

export function QuestConstellation({
  nodeCount = 30,
  maxEdgeDistance = 155,
  pulseCount = 4,
  minNodeSpacing = 60,
  className,
}: QuestConstellationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg) return;

    const SVG_NS = "http://www.w3.org/2000/svg";

    function build(width: number, height: number) {
      if (!svg || width < 100 || height < 100) return;

      svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

      const nodes: { x: number; y: number }[] = [];
      let attempts = 0;
      while (nodes.length < nodeCount && attempts < nodeCount * 50) {
        const x = 30 + Math.random() * (width - 60);
        const y = 30 + Math.random() * (height - 60);
        const tooClose = nodes.some((n) => Math.hypot(n.x - x, n.y - y) < minNodeSpacing);
        if (!tooClose) nodes.push({ x, y });
        attempts++;
      }

      const edges: [number, number, number][] = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
          if (d < maxEdgeDistance) edges.push([i, j, d]);
        }
      }

      const edgesG = svg.querySelector(".tq-edges") as SVGGElement;
      const nodesG = svg.querySelector(".tq-nodes") as SVGGElement;
      const pulsesG = svg.querySelector(".tq-pulses") as SVGGElement;
      edgesG.replaceChildren();
      nodesG.replaceChildren();
      pulsesG.replaceChildren();

      edges.forEach(([a, b]) => {
        const line = document.createElementNS(SVG_NS, "line");
        line.setAttribute("x1", String(nodes[a].x));
        line.setAttribute("y1", String(nodes[a].y));
        line.setAttribute("x2", String(nodes[b].x));
        line.setAttribute("y2", String(nodes[b].y));
        edgesG.appendChild(line);
      });

      nodes.forEach((n, i) => {
        const c = document.createElementNS(SVG_NS, "circle");
        c.setAttribute("cx", String(n.x));
        c.setAttribute("cy", String(n.y));
        c.setAttribute("r", "2");
        c.style.animation = `tq-node-pulse ${5 + (i % 4)}s ease-in-out ${(i * 0.37) % 4.5}s infinite`;
        nodesG.appendChild(c);
      });

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced || edges.length === 0) return;

      const longEdges = [...edges].sort((a, b) => b[2] - a[2]).slice(0, 14);
      const picked: [number, number, number][] = [];
      while (picked.length < pulseCount && longEdges.length > 0) {
        picked.push(longEdges.splice(Math.floor(Math.random() * longEdges.length), 1)[0]);
      }

      picked.forEach(([a, b], idx) => {
        const circle = document.createElementNS(SVG_NS, "circle");
        circle.setAttribute("r", "2.5");
        circle.setAttribute("fill", "var(--primary)");
        circle.setAttribute("opacity", "0");
        const begin = `${0.8 + idx * 1.3}s; p${idx}.end + ${2.5 + idx * 0.8}s`;

        const animX = document.createElementNS(SVG_NS, "animate");
        animX.setAttribute("attributeName", "cx");
        animX.setAttribute("from", String(nodes[a].x));
        animX.setAttribute("to", String(nodes[b].x));
        animX.setAttribute("dur", "1.7s");
        animX.setAttribute("begin", begin);
        animX.setAttribute("id", `p${idx}`);
        circle.appendChild(animX);

        const animY = document.createElementNS(SVG_NS, "animate");
        animY.setAttribute("attributeName", "cy");
        animY.setAttribute("from", String(nodes[a].y));
        animY.setAttribute("to", String(nodes[b].y));
        animY.setAttribute("dur", "1.7s");
        animY.setAttribute("begin", begin);
        circle.appendChild(animY);

        const animOp = document.createElementNS(SVG_NS, "animate");
        animOp.setAttribute("attributeName", "opacity");
        animOp.setAttribute("values", "0;0.9;0.9;0");
        animOp.setAttribute("keyTimes", "0;0.2;0.8;1");
        animOp.setAttribute("dur", "1.7s");
        animOp.setAttribute("begin", begin);
        circle.appendChild(animOp);

        pulsesG.appendChild(circle);
      });
    }

    const { width, height } = container.getBoundingClientRect();
    build(width, height);

    let resizeTimer: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver((entries) => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const rect = entries[0].contentRect;
        build(rect.width, rect.height);
      }, 200);
    });
    ro.observe(container);

    return () => {
      clearTimeout(resizeTimer);
      ro.disconnect();
    };
  }, [nodeCount, maxEdgeDistance, pulseCount, minNodeSpacing]);

  return (
    <div
      ref={containerRef}
      data-tq-decor
      className={className}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}
      aria-hidden="true"
    >
      <svg ref={svgRef} style={{ width: "100%", height: "100%" }} preserveAspectRatio="none">
        <g className="tq-edges" stroke="var(--border)" strokeWidth="0.5" fill="none" />
        <g className="tq-nodes" fill="oklch(0.62 0.21 288 / 0.4)" />
        <g className="tq-pulses" />
      </svg>
    </div>
  );
}
