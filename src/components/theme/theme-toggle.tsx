"use client";

import { useTheme } from "./theme-provider";
import { Sun, Moon } from "lucide-react";

/**
 * One-tap light/dark switch. Shows the current mode's icon; tapping flips it.
 * (Legacy "system" values stored in localStorage still resolve in the
 * provider; the first tap converts them to an explicit light/dark choice.)
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const next = resolvedTheme === "dark" ? "light" : "dark";

  return (
    <button
      onClick={() => setTheme(next)}
      className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted transition-colors"
      aria-label={`Switch to ${next} theme`}
    >
      {resolvedTheme === "dark" ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </button>
  );
}
