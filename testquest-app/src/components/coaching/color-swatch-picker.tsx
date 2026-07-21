"use client";

/**
 * ColorSwatchPicker — 6 brand-color swatches.
 *
 * The selected value is written to Organization.brandingJson.primaryColor; in
 * Phase 3 (Task 3.4 white-label) it will override the --primary CSS variable
 * at the org boundary. For Task 1.4 we just store + preview.
 *
 * All swatch colors come from the existing palette (existing tokens or
 * values already used in the codebase for charts/score colors); we don't
 * introduce any new hue.
 */
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const BRAND_SWATCHES = [
  { name: "Purple",   value: "oklch(0.508 0.251 284.3)" },  // brand --primary #6134EB
  { name: "Lavender", value: "oklch(0.592 0.199 290.3)" },  // brand --accent #815FE9
  { name: "Emerald",  value: "oklch(0.65 0.17 145)"  },  // existing --score-strong
  { name: "Rose",     value: "oklch(0.68 0.15 355)"  },  // existing chart-4
  { name: "Teal",     value: "oklch(0.66 0.14 195)"  },
  { name: "Saffron",  value: "oklch(0.78 0.17 65)"   },
] as const;

export interface ColorSwatchPickerProps {
  value: string;
  onChange: (v: string) => void;
}

export function ColorSwatchPicker({ value, onChange }: ColorSwatchPickerProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {BRAND_SWATCHES.map((s) => {
        const selected = s.value === value;
        return (
          <button
            key={s.name}
            type="button"
            onClick={() => onChange(s.value)}
            className={cn(
              "relative h-12 w-12 rounded-full transition-all hover:scale-105",
              selected ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : "ring-1 ring-border",
            )}
            style={{ background: s.value }}
            aria-label={s.name}
            aria-pressed={selected}
            title={s.name}
          >
            {selected && (
              <Check className="absolute inset-0 m-auto h-5 w-5 text-background drop-shadow-sm" />
            )}
          </button>
        );
      })}
    </div>
  );
}
