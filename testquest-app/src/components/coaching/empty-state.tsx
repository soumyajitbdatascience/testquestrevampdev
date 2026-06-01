/**
 * EmptyState — standard empty-card with icon, headline, body, and primary CTA.
 *
 * UI_PLAN §4 vocabulary + §6.1 empty-state convention.
 */
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  body: string;
  /** Both `ctaLabel` and `ctaHref` are optional — omit for "waiting on data" empties. */
  ctaLabel?: string;
  ctaHref?: string;
}

export function EmptyState({ icon: Icon, title, body, ctaLabel, ctaHref }: EmptyStateProps) {
  const hasCta = ctaLabel && ctaHref;
  return (
    <div className="rounded-[22px] border bg-surface px-8 py-12 text-center">
      {Icon && (
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-dim text-primary">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <h3 className="mt-5 font-display text-2xl">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">{body}</p>
      {hasCta && (
        <Link
          href={ctaHref}
          className="mt-6 inline-flex items-center gap-1.5 rounded-[10px] bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold shadow-gold transition-transform hover:-translate-y-0.5"
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
