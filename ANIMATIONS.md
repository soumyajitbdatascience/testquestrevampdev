# Handoff: Testquest Animation Layer — Meridian Direction

## Overview

This document extends the main `README.md` with **four background animation patterns** for the Meridian direction. It's designed to sit alongside `README.md` and `Testquest Landing.html` as a third reference for the implementing agent.

Each pattern is:
- Scoped to one specific page or section (no global animation soup)
- Written as a self-contained React Client Component for the Next.js 15 / App Router / Tailwind CSS v4 / TypeScript stack
- Built to layer **on top of** the existing background treatment (the 64px grid + dual radial glows) — not replace it
- Compliant with `prefers-reduced-motion: reduce`

**Recommended restraint:** ship at most **two** of these four patterns to production. Edtech users are studying — ambient motion that's everywhere trains them to ignore the interface. The sweet spot is the hero treatment (Pattern 1) plus one ambient treatment (Pattern 3) reused in landing-page sections.

---

## How to use this with Claude Code

Save this file next to `README.md` in the design handoff folder (or at your project root). Then in Claude Code:

```
Read ANIMATIONS.md. Implement Pattern 1 (Quest Constellation) in
the landing hero at src/app/page.tsx. Use the component spec and
TSX provided. Add the required keyframes to src/app/globals.css.
```

You can drop any single pattern in isolation — the four are independent. The keyframes block at the top of this doc can be added to `globals.css` once and reused across patterns.

---

## Design Principles

1. **Layer, don't replace.** Your hero already has a 64px grid + two radial glows (the gold one pulses on the existing `glow` keyframe). New animations layer above the glows, below content. Never modify the existing background structure.

2. **Slow and confident.** Premium coaching institution, not tech-startup. Default durations are 5–90s, not 1–3s. If a v1 feels fast, halve the speed before changing anything else.

3. **Reduced motion is mandatory, not optional.** Every component honors `prefers-reduced-motion: reduce`. The static state must still look intentional — never blank.

4. **Indian-market context.** TestQuest serves Class 6–12 CBSE/ICSE/State Board students. Cultural references are subtle (Devanagari numerals in Pattern 3, mandala/yantra geometry in Pattern 4) — they are flavor, not theme. Heavy ethnic ornamentation reads as patronizing to the audience that actually lives there.

5. **Performance budget.** Total cost of all enabled animations should stay under 5% CPU on a mid-range Android device. CSS animations are free; SVG SMIL is cheap; `requestAnimationFrame` loops must self-pause via `document.visibilityState === 'hidden'`.

---

## Add to `src/app/globals.css`

These keyframes are shared across multiple patterns. Add them once.

```css
/* Quest constellation — Pattern 1 */
@keyframes tq-node-pulse {
  0%, 100% { opacity: 0.22; }
  50%      { opacity: 0.55; }
}

/* Achievement pulse rings — Pattern 2 */
@keyframes tq-ring-expand {
  0%   { transform: scale(0.4); opacity: 0.55; }
  100% { transform: scale(2.4); opacity: 0; }
}

/* Drifting formulas — Pattern 3 */
@keyframes tq-formula-drift {
  0%   { transform: translate(0, 0); opacity: 0; }
  12%  { opacity: var(--tq-formula-op, 0.08); }
  88%  { opacity: var(--tq-formula-op, 0.08); }
  100% { transform: translate(var(--tq-drift-x, 1400px), var(--tq-drift-y, -1000px)); opacity: 0; }
}

/* Rotating yantra — Pattern 4 (CSS fallback only; SVG uses animateTransform) */
@keyframes tq-rotate-cw  { to { transform: rotate(360deg); } }
@keyframes tq-rotate-ccw { to { transform: rotate(-360deg); } }
```

---

## File Structure

Create the following decorative-component folder:

```
src/components/decor/
├── QuestConstellation.tsx       — Pattern 1
├── AchievementPulseRings.tsx    — Pattern 2 (rings)
├── useCountUp.ts                — Pattern 2 (hook)
├── DriftingFormulas.tsx         — Pattern 3
└── RotatingYantra.tsx           — Pattern 4
```

All components are Client Components (`'use client'`).

---

## Pattern 1: Quest Constellation

**Use in:** Landing hero — `src/app/page.tsx`, inside the `<Hero>` section.
**Layer position:** Above the existing 64px grid and the two radial glows. Below content (z-index 1+).
**Why this fits:** The constellation reads as a "quest map" — directly ties to the TestQuest brand name. Gold pulses traveling along edges suggest progress on a learning path.

### Original prompt (for reference / iteration with Claude design)

> Add a subtle background animation layer to the TestQuest hero section. This sits **on top of** the existing 64px grid overlay and the two radial gradient glows (gold top-right, teal bottom-left) — do not remove or modify those.
>
> Render an SVG layer of ~30 small nodes (3–5px dots) scattered across the hero viewport, connected by faint 1px lines into a loose constellation, like a "quest map." Every 4–6 seconds a soft gold pulse travels from one random node along one of its edges to a neighbor. Nodes themselves have a very gentle pulse (opacity 0.3 ↔ 0.55, staggered, 6s cycles).
>
> Use `var(--primary)` for the traveling pulse, `var(--foreground)` at 25% opacity for the static nodes, `var(--border)` for the lines. Position absolute, inset 0, `pointer-events: none`, z-index between the glows (z-0) and the content (z-1).
>
> Disable all animation under `prefers-reduced-motion: reduce` (show the static constellation, no pulses).

### Component: `src/components/decor/QuestConstellation.tsx`

```tsx
'use client';

import { useEffect, useRef } from 'react';

interface QuestConstellationProps {
  /** Approximate node count. Actual may be lower if container is small. Default 30. */
  nodeCount?: number;
  /** Maximum pixel distance between nodes for an edge to be drawn. Default 155. */
  maxEdgeDistance?: number;
  /** Number of traveling gold pulses. Default 4. */
  pulseCount?: number;
  /** Minimum spacing between nodes in pixels. Default 60. */
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

    const SVG_NS = 'http://www.w3.org/2000/svg';

    function build(width: number, height: number) {
      if (width < 100 || height < 100) return;

      svg!.setAttribute('viewBox', `0 0 ${width} ${height}`);

      // Generate nodes with minimum spacing
      const nodes: { x: number; y: number }[] = [];
      let attempts = 0;
      while (nodes.length < nodeCount && attempts < nodeCount * 50) {
        const x = 30 + Math.random() * (width - 60);
        const y = 30 + Math.random() * (height - 60);
        const tooClose = nodes.some(n => Math.hypot(n.x - x, n.y - y) < minNodeSpacing);
        if (!tooClose) nodes.push({ x, y });
        attempts++;
      }

      // Build edges within MAX_DIST
      const edges: [number, number, number][] = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
          if (d < maxEdgeDistance) edges.push([i, j, d]);
        }
      }

      const edgesG = svg!.querySelector('.tq-edges') as SVGGElement;
      const nodesG = svg!.querySelector('.tq-nodes') as SVGGElement;
      const pulsesG = svg!.querySelector('.tq-pulses') as SVGGElement;
      edgesG.replaceChildren();
      nodesG.replaceChildren();
      pulsesG.replaceChildren();

      edges.forEach(([a, b]) => {
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', String(nodes[a].x));
        line.setAttribute('y1', String(nodes[a].y));
        line.setAttribute('x2', String(nodes[b].x));
        line.setAttribute('y2', String(nodes[b].y));
        edgesG.appendChild(line);
      });

      nodes.forEach((n, i) => {
        const c = document.createElementNS(SVG_NS, 'circle');
        c.setAttribute('cx', String(n.x));
        c.setAttribute('cy', String(n.y));
        c.setAttribute('r', '2');
        c.style.animation = `tq-node-pulse ${5 + (i % 4)}s ease-in-out ${(i * 0.37) % 4.5}s infinite`;
        nodesG.appendChild(c);
      });

      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced || edges.length === 0) return;

      // Pick a few long-ish edges to pulse along
      const longEdges = [...edges].sort((a, b) => b[2] - a[2]).slice(0, 14);
      const picked: [number, number, number][] = [];
      while (picked.length < pulseCount && longEdges.length > 0) {
        picked.push(longEdges.splice(Math.floor(Math.random() * longEdges.length), 1)[0]);
      }

      picked.forEach(([a, b], idx) => {
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('r', '2.5');
        circle.setAttribute('fill', 'var(--primary)');
        circle.setAttribute('opacity', '0');
        const begin = `${0.8 + idx * 1.3}s; p${idx}.end + ${2.5 + idx * 0.8}s`;

        const animX = document.createElementNS(SVG_NS, 'animate');
        animX.setAttribute('attributeName', 'cx');
        animX.setAttribute('from', String(nodes[a].x));
        animX.setAttribute('to', String(nodes[b].x));
        animX.setAttribute('dur', '1.7s');
        animX.setAttribute('begin', begin);
        animX.setAttribute('id', `p${idx}`);
        circle.appendChild(animX);

        const animY = document.createElementNS(SVG_NS, 'animate');
        animY.setAttribute('attributeName', 'cy');
        animY.setAttribute('from', String(nodes[a].y));
        animY.setAttribute('to', String(nodes[b].y));
        animY.setAttribute('dur', '1.7s');
        animY.setAttribute('begin', begin);
        circle.appendChild(animY);

        const animOp = document.createElementNS(SVG_NS, 'animate');
        animOp.setAttribute('attributeName', 'opacity');
        animOp.setAttribute('values', '0;0.9;0.9;0');
        animOp.setAttribute('keyTimes', '0;0.2;0.8;1');
        animOp.setAttribute('dur', '1.7s');
        animOp.setAttribute('begin', begin);
        circle.appendChild(animOp);

        pulsesG.appendChild(circle);
      });
    }

    const { width, height } = container.getBoundingClientRect();
    build(width, height);

    let resizeTimer: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(entries => {
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
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
      }}
      aria-hidden="true"
    >
      <svg
        ref={svgRef}
        style={{ width: '100%', height: '100%' }}
        preserveAspectRatio="none"
      >
        <g className="tq-edges" stroke="var(--border)" strokeWidth="0.5" fill="none" />
        <g className="tq-nodes" fill="oklch(0.96 0.005 265 / 0.4)" />
        <g className="tq-pulses" />
      </svg>
    </div>
  );
}
```

### Usage

```tsx
// src/app/page.tsx — inside <Hero> section, after the two radial-glow divs
// and the grid div, before the main content:

<section style={{ position: 'relative', overflow: 'hidden', ... }}>
  {/* Existing background glows */}
  <div style={{ /* gold radial glow with `glow` keyframe */ }} />
  <div style={{ /* teal radial glow */ }} />
  <div style={{ /* 64px grid */ }} />

  {/* NEW: constellation layer */}
  <QuestConstellation />

  {/* Existing content */}
  <div style={{ position: 'relative', zIndex: 1, ... }}>
    {/* H1, badge, CTAs, stat cards */}
  </div>
</section>
```

### Tuning notes

- **Too sparse?** Bump `nodeCount` to 38–42 and lower `minNodeSpacing` to 50.
- **Too busy?** Drop `nodeCount` to 22 and raise `minNodeSpacing` to 75.
- **Pulses too prominent?** Change the inline `fill="var(--primary)"` to `oklch(0.76 0.17 72 / 0.7)` and the opacity peak from `0.9` to `0.55`.
- **Pulses too quiet?** Bump pulse circle radius from `2.5` to `3.5`.

---

## Pattern 2: Achievement Pulse Rings + Count-up

**Use in:** Dashboard — `src/app/dashboard/page.tsx`, specifically behind the highlighted **Average score** stat tile. Also reusable in the Stats Counter Section of the landing page.
**Layer position:** Inside the highlighted stat tile, behind the stat value.
**Why this fits:** Reinforces achievement without competing with the data. The pulse is tied to the one meaningful number on the page.

### Original prompt

> Add a background animation behind the highlighted stat number that reinforces achievement without distraction. Behind the stat number, render a soft expanding ring pulse: a thin circle that starts small at the center, expands while fading, then restarts. Two staggered rings work better than one. Pause when tab is hidden. Respect `prefers-reduced-motion` — show one static ring at low opacity.

### Component: `src/components/decor/AchievementPulseRings.tsx`

```tsx
'use client';

interface AchievementPulseRingsProps {
  /** Ring stroke color. Default 'currentColor' (inherits from parent text color). */
  color?: string;
  /** Number of staggered rings. Default 2. */
  ringCount?: number;
  /** Duration per ring expansion in seconds. Default 2.8. */
  duration?: number;
  /** Final scale multiplier. Default 2.4. */
  finalScale?: number;
  /** Anchor position relative to parent. Default 'center'. */
  anchor?: 'center' | 'top-left' | 'bottom-right';
}

export function AchievementPulseRings({
  color = 'currentColor',
  ringCount = 2,
  duration = 2.8,
  finalScale = 2.4,
  anchor = 'top-left',
}: AchievementPulseRingsProps) {
  const positionStyle: React.CSSProperties =
    anchor === 'center'
      ? { top: '50%', left: '50%', marginTop: -15, marginLeft: -15 }
      : anchor === 'bottom-right'
        ? { bottom: 18, right: 18 }
        : { top: 28, left: 13 };

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        pointerEvents: 'none',
        ...positionStyle,
      }}
    >
      {Array.from({ length: ringCount }).map((_, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            inset: 0,
            width: 30,
            height: 30,
            borderRadius: '50%',
            border: `1.5px solid ${color}`,
            opacity: 0,
            animation: `tq-ring-expand ${duration}s ease-out infinite`,
            animationDelay: `${(i * duration) / ringCount}s`,
            // @ts-expect-error custom property
            '--final-scale': finalScale,
          }}
        />
      ))}
    </div>
  );
}
```

Note: the keyframe `tq-ring-expand` in `globals.css` ends at `scale(2.4)`. If you want a different final scale per usage, parameterize the keyframe via a custom property:

```css
@keyframes tq-ring-expand {
  0%   { transform: scale(0.4); opacity: 0.55; }
  100% { transform: scale(var(--final-scale, 2.4)); opacity: 0; }
}
```

### Hook: `src/components/decor/useCountUp.ts`

```ts
'use client';

import { useEffect, useRef, useState } from 'react';

interface UseCountUpOptions {
  /** Target final value. */
  target: number;
  /** Duration in milliseconds. Default 1700. */
  duration?: number;
  /** Trigger threshold for IntersectionObserver. Default 0.4. */
  threshold?: number;
  /** Start delay in milliseconds. Default 0. */
  startDelay?: number;
}

/**
 * Counts up from 0 to target with cubic ease-out when the
 * returned ref enters the viewport. Respects prefers-reduced-motion
 * (snaps directly to target).
 */
export function useCountUp({
  target,
  duration = 1700,
  threshold = 0.4,
  startDelay = 0,
}: UseCountUpOptions) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLElement | null>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || hasRun.current) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setValue(target);
      hasRun.current = true;
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (!entry.isIntersecting || hasRun.current) return;
        hasRun.current = true;

        setTimeout(() => {
          const start = performance.now();
          function frame(now: number) {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            setValue(Math.round(target * eased));
            if (t < 1) requestAnimationFrame(frame);
          }
          requestAnimationFrame(frame);
        }, startDelay);

        observer.disconnect();
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration, threshold, startDelay]);

  return { value, ref };
}
```

### Usage

```tsx
// Inside the highlighted Average Score tile in src/app/dashboard/page.tsx
import { AchievementPulseRings } from '@/components/decor/AchievementPulseRings';
import { useCountUp } from '@/components/decor/useCountUp';

function AverageScoreTile() {
  const { value, ref } = useCountUp({ target: 78, duration: 1700 });

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--primary)',
        color: 'var(--background)',
        borderRadius: 16,
        padding: '13px 15px',
        boxShadow: 'var(--primary-glow)',
      }}
    >
      <AchievementPulseRings color="var(--background)" anchor="top-left" />
      <div style={{ fontSize: 10.5, opacity: 0.7 }}>Average score</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, position: 'relative', zIndex: 3 }}>
        {value}%
      </div>
      <div style={{ fontSize: 10, opacity: 0.72, marginTop: 5 }}>↑ 6 pts vs last month</div>
    </div>
  );
}
```

Apply the same `useCountUp` hook to the other three stat tiles. The pulse rings only appear on the highlighted tile.

### Tuning notes

- The same `AchievementPulseRings` component is used in the landing page **Stats Counter Section** with `color="oklch(0.65 0.17 145)"` (emerald) since that section sits on a dark surface, not a gold surface.
- For three-column stats counter, render three independent `AchievementPulseRings`, each with a different `animation-delay` so the rings are visually offset.

---

## Pattern 3: Drifting Formulas

**Use in:** Landing page section breaks (between How It Works and Quiz Demo, and around the Pricing Teaser), OR as a global page-background layer on `src/app/tests/page.tsx`.
**Layer position:** Behind cards and content, above the page background.
**Why this fits:** Ambient texture only — never legible content. Reads as "chalk dust drifting through a coaching center."

### Original prompt

> Float ~15 small academic glyphs slowly diagonally across the viewport: `∫`, `√`, `π`, `Σ`, `½`, `θ`, `H₂O`, `E=mc²`, `sin`, `cos`, and Devanagari numerals `१ २ ३ ४ ५` mixed in (one or two only — subtle nod to Indian classrooms, not heavy-handed). Use DM Serif Display, font-size 16–28px varied, color `var(--foreground)` at **6–9% opacity only**.
>
> Each glyph has its own animation-duration between 35s and 70s, random animation-delay so they don't enter in waves. Pure CSS, no JS for the motion. Respect `prefers-reduced-motion`.

### Component: `src/components/decor/DriftingFormulas.tsx`

```tsx
'use client';

interface FormulaSpec {
  /** Glyph or short formula text. */
  text: string;
  /** Font size in pixels. */
  size: number;
  /** Start x position as percentage of container width (0–100). */
  xPct: number;
  /** Start y position as percentage of container height (0–100). */
  yPct: number;
  /** Animation duration in seconds. */
  duration: number;
  /** Negative animation-delay so cycles are offset on first render. */
  delay: number;
}

interface DriftingFormulasProps {
  /** Formulas to render. Defaults to the curated set below. */
  formulas?: FormulaSpec[];
  /** Opacity of formulas at peak. Default 0.08. Production-safe range: 0.06–0.10. */
  opacity?: number;
}

const DEFAULT_FORMULAS: FormulaSpec[] = [
  { text: '∫',     size: 30, xPct: 7,  yPct: 8,  duration: 55, delay: -2  },
  { text: '√x',    size: 22, xPct: 33, yPct: 16, duration: 48, delay: -20 },
  { text: 'π',     size: 32, xPct: 60, yPct: 6,  duration: 62, delay: -8  },
  { text: 'Σ',     size: 26, xPct: 79, yPct: 20, duration: 51, delay: -34 },
  { text: '½',     size: 22, xPct: 10, yPct: 41, duration: 44, delay: -12 },
  { text: 'θ',     size: 24, xPct: 47, yPct: 45, duration: 58, delay: -28 },
  { text: 'H₂O',   size: 20, xPct: 70, yPct: 38, duration: 60, delay: -5  },
  { text: 'sin θ', size: 18, xPct: 21, yPct: 68, duration: 47, delay: -18 },
  { text: 'cos²',  size: 18, xPct: 60, yPct: 72, duration: 53, delay: -40 },
  { text: 'E=mc²', size: 20, xPct: 82, yPct: 61, duration: 65, delay: -22 },
  { text: '१',     size: 26, xPct: 4,  yPct: 83, duration: 50, delay: -30 },
  { text: '३',     size: 24, xPct: 41, yPct: 85, duration: 54, delay: -10 },
  { text: '५',     size: 22, xPct: 73, yPct: 83, duration: 49, delay: -45 },
  { text: '२',     size: 28, xPct: 89, yPct: 76, duration: 58, delay: -3  },
];

export function DriftingFormulas({
  formulas = DEFAULT_FORMULAS,
  opacity = 0.08,
}: DriftingFormulasProps) {
  return (
    <div
      aria-hidden="true"
      style={
        {
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 0,
          '--tq-formula-op': opacity,
        } as React.CSSProperties
      }
    >
      {formulas.map((f, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: `${f.xPct}%`,
            top: `${f.yPct}%`,
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: f.size,
            color: 'var(--foreground)',
            whiteSpace: 'nowrap',
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
```

### Usage

```tsx
// As a section background — wrap the section in position: relative and add:
<section style={{ position: 'relative', overflow: 'hidden', ... }}>
  <DriftingFormulas />
  <div style={{ position: 'relative', zIndex: 1, ... }}>
    {/* section content */}
  </div>
</section>

// As a global page background on /tests:
// In src/app/tests/page.tsx, wrap the page content in a relative container:
<div style={{ position: 'relative', minHeight: '100vh' }}>
  <DriftingFormulas opacity={0.07} />
  <div style={{ position: 'relative', zIndex: 1 }}>
    {/* filter bar, card grid */}
  </div>
</div>
```

### Tuning notes

- Keep `opacity` between 0.06 and 0.10 in production. Above 0.10 the formulas read as content. Below 0.05 they vanish entirely on darker monitors.
- The default set has 14 formulas. For a smaller container (a single section, not full page), reduce to 8 by filtering: `formulas={DEFAULT_FORMULAS.slice(0, 8)}`.
- Do **not** add more Devanagari numerals beyond the four in the default set. Subtle nod, not theme.

### Reduced-motion handling

The keyframe contains its own opacity values. To handle reduced motion, add this to `globals.css`:

```css
@media (prefers-reduced-motion: reduce) {
  [class*="tq-formula"], [style*="tq-formula-drift"] {
    animation: none !important;
    opacity: var(--tq-formula-op, 0.08) !important;
    transform: translate(100px, -120px);
  }
}
```

---

## Pattern 4: Rotating Yantra

**Use in:** Login page — `src/app/login/page.tsx`, behind the left-panel headline. Optionally the Final CTA section of the landing page.
**Layer position:** Behind the left-panel content, centered.
**Why this fits:** A single decorative statement piece for a quiet screen. Three rotating layers at different speeds suggest a brass astrolabe — patient, knowledge-related, culturally resonant without being clichéd.

### Original prompt

> Create a slowly rotating geometric pattern inspired by mandala / yantra geometry — stripped down and modernized, NOT ornate or ethnic-cliché. Concentric polygons with thin 1px strokes in `var(--primary)` at low opacity. Each ring rotates at a different speed (outer slowest, inner fastest, alternating directions) — almost imperceptibly slow. Like a brass astrolabe in a study. No fills, only strokes. `pointer-events: none`. Respect `prefers-reduced-motion`.

### Component: `src/components/decor/RotatingYantra.tsx`

```tsx
'use client';

import { useEffect, useRef } from 'react';

interface RotatingYantraProps {
  /** Total diameter in pixels. Default 320. */
  size?: number;
  /** Stroke color. Default 'var(--primary)'. */
  color?: string;
  /** Class for positioning the SVG. */
  className?: string;
}

export function RotatingYantra({
  size = 320,
  color = 'var(--primary)',
  className,
}: RotatingYantraProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const SVG_NS = 'http://www.w3.org/2000/svg';
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
      return pts.join(' ');
    }

    svg.replaceChildren();
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);

    // Static concentric circles
    [size * 0.44, size * 0.34, size * 0.24, size * 0.13, size * 0.056].forEach((r, i) => {
      svg.appendChild(
        el('circle', {
          cx, cy, r,
          fill: 'none',
          stroke: color,
          'stroke-opacity': 0.10 + i * 0.02,
          'stroke-width': 0.5,
        })
      );
    });

    // 24 short radial ticks (outer ornament)
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * 2 * Math.PI - Math.PI / 2;
      const inner = size * 0.45, outer = size * 0.47;
      svg.appendChild(
        el('line', {
          x1: cx + inner * Math.cos(a),
          y1: cy + inner * Math.sin(a),
          x2: cx + outer * Math.cos(a),
          y2: cy + outer * Math.sin(a),
          stroke: color,
          'stroke-opacity': 0.16,
          'stroke-width': 0.5,
        })
      );
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Outer dot ring (12 dots), clockwise 90s
    const outer = el('g', {});
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI / 2 + (i / 12) * 2 * Math.PI;
      outer.appendChild(
        el('circle', {
          cx: cx + size * 0.39 * Math.cos(a),
          cy: cy + size * 0.39 * Math.sin(a),
          r: 2.2,
          fill: color,
          'fill-opacity': 0.45,
        })
      );
    }
    if (!reduced) {
      outer.appendChild(
        el('animateTransform', {
          attributeName: 'transform', type: 'rotate',
          from: `0 ${cx} ${cy}`, to: `360 ${cx} ${cy}`,
          dur: '90s', repeatCount: 'indefinite',
        })
      );
    }
    svg.appendChild(outer);

    // Middle 12-sided + 6-sided polygons, counter-clockwise 60s
    const mid = el('g', {});
    mid.appendChild(
      el('polygon', {
        points: polyPts(12, size * 0.30),
        fill: 'none', stroke: color,
        'stroke-opacity': 0.22, 'stroke-width': 0.6,
      })
    );
    mid.appendChild(
      el('polygon', {
        points: polyPts(6, size * 0.30),
        fill: 'none', stroke: color,
        'stroke-opacity': 0.18, 'stroke-width': 0.5,
      })
    );
    if (!reduced) {
      mid.appendChild(
        el('animateTransform', {
          attributeName: 'transform', type: 'rotate',
          from: `0 ${cx} ${cy}`, to: `-360 ${cx} ${cy}`,
          dur: '60s', repeatCount: 'indefinite',
        })
      );
    }
    svg.appendChild(mid);

    // Inner hexagram (Star of David), clockwise 40s
    const inner = el('g', {});
    inner.appendChild(
      el('polygon', {
        points: polyPts(3, size * 0.18, -Math.PI / 2),
        fill: 'none', stroke: color,
        'stroke-opacity': 0.25, 'stroke-width': 0.6,
      })
    );
    inner.appendChild(
      el('polygon', {
        points: polyPts(3, size * 0.18, Math.PI / 2),
        fill: 'none', stroke: color,
        'stroke-opacity': 0.25, 'stroke-width': 0.6,
      })
    );
    if (!reduced) {
      inner.appendChild(
        el('animateTransform', {
          attributeName: 'transform', type: 'rotate',
          from: `0 ${cx} ${cy}`, to: `360 ${cx} ${cy}`,
          dur: '40s', repeatCount: 'indefinite',
        })
      );
    }
    svg.appendChild(inner);

    // Central bindu
    svg.appendChild(
      el('circle', { cx, cy, r: 3, fill: color, 'fill-opacity': 0.55 })
    );
  }, [size, color]);

  return (
    <svg
      ref={svgRef}
      className={className}
      aria-hidden="true"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        pointerEvents: 'none',
      }}
    />
  );
}
```

### Usage

```tsx
// src/app/login/page.tsx — inside the left dark panel:
<div style={{ position: 'relative', overflow: 'hidden', background: 'var(--surface)', ... }}>
  <RotatingYantra
    size={320}
    className="tq-yantra-position"
  />
  <div style={{ position: 'relative', zIndex: 2 }}>
    {/* logo, heading, subtext */}
  </div>
</div>
```

Add the position class to `globals.css`:

```css
.tq-yantra-position {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
```

### Tuning notes

- For the Final CTA section, use `size={280}` and position with `top: -60px; right: -60px;` so the yantra peeks from the corner. This mirrors the existing radial-glow placement.
- The rotation directions and durations (90s cw / 60s ccw / 40s cw) create a non-repeating apparent motion. Don't sync them all to the same direction or speed.

---

## Suggested rollout

If you ship all four, you have animation noise across the entire product. Recommended sequencing:

1. **Pattern 1 — Quest Constellation** in the landing hero. Highest impact, most TestQuest-on-brand.
2. **Pattern 2 — Achievement Pulse Rings + Count-up** on the dashboard and the stats counter. Data-supportive, never decorative.
3. **Stop and ship.** Run with these two for two weeks. Watch the analytics — bounce rate, time-to-first-action, dashboard engagement.
4. Only after data confirms users aren't distracted, consider **Pattern 3 — Drifting Formulas** as a low-opacity layer on `/tests`.
5. **Pattern 4 — Rotating Yantra** is optional and a matter of taste. The login page works perfectly with just the existing surface color.

---

## Iteration prompts

Use these one-liners in Claude Code or Claude design when the first pass isn't quite right:

- *"Half the speed and half the opacity on everything. It's competing with my H1."*
- *"The motion should feel like it's already been running for an hour when you arrive on the page — no entrance flourish, just steady state."*
- *"Add `@media (prefers-reduced-motion: reduce)` handling — show the static version, no animation loops."*
- *"Show me three variations of just the [color / speed / density] so I can pick."*
- *"It feels too 'tech startup.' I need it to feel like a premium Indian coaching institution — confident, exam-serious, gold-leaf-not-neon."*
- *"Pause all animations when `document.visibilityState === 'hidden'` so background tabs don't burn battery."*

---

## Files in this bundle

| File | Purpose |
|---|---|
| `README.md` | **Primary design handoff.** Tokens, screens, layout specs. |
| `Testquest Landing.html` | Animated HTML prototype reference. |
| `Testquest Revamp.html` | Three explored directions, side-by-side. |
| `ANIMATIONS.md` | **This file.** Four background animation patterns with full component code. |

---

## Notes for Claude Code

- All four components are Client Components — they must include `'use client'` at the top.
- The components use `var(--primary)`, `var(--foreground)`, `var(--border)`, etc. — these are defined in `globals.css` per the main README. Don't hardcode oklch values inside the components.
- The Constellation and Formulas components use `ResizeObserver` and absolute positioning. Their parent **must** have `position: relative` and `overflow: hidden`.
- If you're integrating with the existing `Hero` section, the constellation z-index is `0`; existing radial glows are also implicitly `0` (auto stacking order). Constellation should appear **after** the glows in DOM order so it stacks on top within the same z-index level.
- The count-up uses `IntersectionObserver` with threshold 0.4 — adjust if your stat tiles are large and the threshold never triggers.
- For SSR safety, all `window.matchMedia` and `IntersectionObserver` references are inside `useEffect`, which only runs client-side.
