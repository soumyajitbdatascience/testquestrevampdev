/**
 * PlanComparisonCard — one pricing tier card (Starter / Growth / Pro / Enterprise).
 *
 * Per UI_PLAN §4 vocabulary. Used on /for-coaching-centres landing and (later)
 * on /coaching/billing upgrade screens with selectedTier pre-highlighted.
 *
 * All colors come from the existing token system in src/app/globals.css —
 * no new color values introduced.
 */
import { Check, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface PlanTier {
  name: string;
  tagline: string;
  /** Display string, e.g. "₹149 / student / month" or "Custom". */
  priceLine: string;
  /** Optional, e.g. "Free for 14 days" or "Billed annually". */
  subPrice?: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  /** Highlight one card in a row (default Pro). */
  highlighted?: boolean;
}

export function PlanComparisonCard({ plan }: { plan: PlanTier }) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-[22px] border bg-surface px-6 py-7 transition-all",
        plan.highlighted
          ? "border-primary shadow-gold ring-1 ring-primary/40"
          : "hover:-translate-y-[3px] hover:shadow-soft",
      )}
    >
      {plan.highlighted && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-3 py-1 text-[10px] font-bold uppercase tracking-widest">
          Most popular
        </span>
      )}

      <div>
        <h3 className="font-display text-2xl">{plan.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
      </div>

      <div className="mt-5">
        <p className="font-display text-3xl">
          {plan.priceLine}
        </p>
        {plan.subPrice && (
          <p className="mt-1 text-xs text-muted-foreground">{plan.subPrice}</p>
        )}
      </div>

      <ul className="mt-6 space-y-3 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm">
            <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <span className="text-foreground/90">{f}</span>
          </li>
        ))}
      </ul>

      <Link
        href={plan.ctaHref}
        className={cn(
          "mt-7 inline-flex items-center justify-center gap-1.5 rounded-[10px] px-5 py-3 text-sm font-bold transition-transform hover:-translate-y-0.5",
          plan.highlighted
            ? "bg-primary text-primary-foreground shadow-gold"
            : "border border-strong text-foreground hover:bg-white/5",
        )}
      >
        {plan.ctaLabel}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
