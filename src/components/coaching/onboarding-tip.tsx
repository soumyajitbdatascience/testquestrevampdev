"use client";

/**
 * First-visit onboarding callout for the centre owner. Renders inline above
 * the dashboard body. Single tooltip — no multi-step tour — per Task 1.12.
 *
 * The dashboard server-component decides whether to mount this based on
 * `Organization.brandingJson.onboardingDismissed`. The action `dismissOnboarding`
 * flips that flag and revalidates the dashboard so the tip stops rendering.
 *
 * The CTA target is data-driven: if the owner has no batches yet, point at
 * "Create a batch"; if they have a batch but no assignments, point at
 * "Assign a test"; otherwise just say "You're all set."
 */
import { useTransition } from "react";
import Link from "next/link";
import { Sparkles, X, ArrowRight } from "lucide-react";
import { dismissOnboarding } from "@/app/coaching/_actions/auth";

type Variant = "create-batch" | "assign-test" | "all-set";

const COPY: Record<Variant, { title: string; body: string; cta?: { label: string; href: string } }> = {
  "create-batch": {
    title: "Welcome to Testquest.",
    body: "Start by creating a batch — that's a group of students. You'll assign tests to a whole batch at once.",
    cta: { label: "Create batch", href: "/coaching/batches/new" },
  },
  "assign-test": {
    title: "Nice — your first batch is ready.",
    body: "Pick a test from Testquest's bank and assign it. Students get an SMS with the link.",
    cta: { label: "Assign a test", href: "/coaching/dashboard" },
  },
  "all-set": {
    title: "You're up and running.",
    body: "Watch results land in real time on the assignment page. Hit Sign out anytime — your data stays put.",
  },
};

export function OnboardingTip({ variant }: { variant: Variant }) {
  const [pending, start] = useTransition();
  const copy = COPY[variant];

  return (
    <div className="mb-8 relative rounded-[18px] border border-primary/40 bg-primary-dim/40 px-6 py-5 pr-12">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-primary">Quick tour</p>
          <h3 className="mt-0.5 font-display text-lg">{copy.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-xl">{copy.body}</p>
          {copy.cta && (
            <Link
              href={copy.cta.href}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              {copy.cta.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => start(() => dismissOnboarding())}
        disabled={pending}
        className="absolute top-3 right-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5 disabled:opacity-50"
        aria-label="Dismiss tour"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
