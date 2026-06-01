"use client";

import { useEffect, useRef } from "react";

/**
 * Adds `.in` class when the element enters the viewport.
 * Pairs with the `.reveal` utility class in globals.css.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  threshold = 0.18
) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return ref;
}
