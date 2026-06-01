/**
 * TrialBanner — top-of-page banner with days-left counter + upgrade CTA.
 *
 * Renders only when there's an active TRIAL subscription. Variants:
 *   - normal:  > 3 days left, primary-dim background
 *   - urgent:  <= 3 days, destructive-tinted, more attention-grabbing
 */
import Link from "next/link";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TrialBannerProps {
  /** Subscription banner kind from resolveSubscriptionState(). */
  banner?: "none" | "trial_ending" | "grace" | "expired";
  /** Days left on the current period; negative for expired. */
  daysLeft: number | null;
  planName: string | null;
  upgradeHref?: string;
}

/**
 * Trial / lifecycle banner. Variants:
 *  - "none"          → renders nothing (>= 3 days left on trial / active sub)
 *  - "trial_ending"  → "Your trial ends in N days. Upgrade now to save 30%."
 *  - "grace"         → "Trial ended. New assignments paused. Upgrade to continue."
 *  - "expired"       → "Subscription expired. Contact support."
 *
 * Legacy callsites that pass only daysLeft + planName fall back to the
 * trial_ending variant when daysLeft <= 3.
 */
export function TrialBanner({
  banner, daysLeft, planName, upgradeHref = "/coaching/billing",
}: TrialBannerProps) {
  const kind: TrialBannerProps["banner"] =
    banner ?? (daysLeft != null && daysLeft <= 3 ? "trial_ending" : "none");
  if (kind === "none") return null;

  const urgent = kind !== "trial_ending" ? true : (daysLeft != null && daysLeft <= 3);

  let body: React.ReactNode;
  let cta: React.ReactNode = (
    <Link
      href={upgradeHref}
      className={cn(
        "inline-flex items-center gap-1 underline underline-offset-2 hover:no-underline",
        urgent ? "text-destructive" : "text-primary",
      )}
    >
      Upgrade
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );

  if (kind === "trial_ending") {
    body = (
      <>
        Trial · {daysLeft} {daysLeft === 1 ? "day" : "days"} left
        {planName && (
          <span className={cn("opacity-80 font-normal", urgent ? "text-destructive/80" : "text-primary/80")}>
            {" "}· {planName} plan
          </span>
        )}
      </>
    );
  } else if (kind === "grace") {
    body = <>Trial ended. New assignments paused. Upgrade to continue.</>;
  } else if (kind === "expired") {
    body = <>Subscription expired. Contact support.</>;
    cta = (
      <a
        href="mailto:support@testquest.in"
        className="text-destructive underline underline-offset-2 hover:no-underline"
      >
        Email support
      </a>
    );
  }

  return (
    <div
      className={cn(
        "rounded-[10px] border px-4 py-3 flex items-center justify-between gap-3 text-sm",
        urgent
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-primary/40 bg-primary-dim text-primary",
      )}
    >
      <span className="inline-flex items-center gap-2 font-medium">
        {urgent && <AlertTriangle className="h-4 w-4" />}
        {body}
      </span>
      {cta}
    </div>
  );
}
