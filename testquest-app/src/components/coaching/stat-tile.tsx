/**
 * StatTile — numeric summary card with an optional accent + delta line.
 *
 * UI_PLAN §4 vocabulary. Used on /coaching/dashboard (Task 1.6) and (future)
 * /admin/organizations summary screens. Server-component-friendly.
 */
import { cn } from "@/lib/utils";

export interface StatTileProps {
  label: string;
  /** Allow string ("—") for "no data yet" states. */
  value: string | number;
  /** Optional secondary detail line. */
  sublabel?: string;
  /** Render the value in saffron italic when true; useful for highlight tiles. */
  accent?: boolean;
}

export function StatTile({ label, value, sublabel, accent }: StatTileProps) {
  return (
    <div className="rounded-[14px] border bg-surface px-5 py-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-display text-3xl", accent && "text-primary italic")}>{value}</p>
      {sublabel && <p className="mt-1 text-[11px] text-muted-foreground">{sublabel}</p>}
    </div>
  );
}
