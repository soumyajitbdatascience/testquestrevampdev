"use client";

import { useEffect, useRef, useState } from "react";

interface UseCountUpOptions {
  target: number;
  duration?: number;
  threshold?: number;
  startDelay?: number;
}

/**
 * Counts up from 0 → target with cubic ease-out when the returned ref
 * enters the viewport. Respects `prefers-reduced-motion`.
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

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setValue(target);
      hasRun.current = true;
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
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
