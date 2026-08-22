/**
 * /coaching/billing — plan + upgrade (UI_PLAN §5.1.8, Task 1.11).
 *
 * Server shell loads current subscription state and the catalogue of
 * coaching-tier plans, then renders the BillingClient which handles the
 * Razorpay checkout handoff.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { resolveSubscriptionState } from "@/lib/services/subscription.service";
import { CoachingHeader } from "@/components/coaching/coaching-header";
import { BillingClient } from "./billing-client";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const session = await getSession();
  if (!session || !session.orgId) redirect("/coaching/login");
  if (session.orgRole !== "OWNER" && session.orgRole !== "ADMIN") redirect("/coaching/dashboard");

  const [state, plans] = await Promise.all([
    resolveSubscriptionState(session.orgId),
    prisma.subscriptionPlan.findMany({
      where: { isActive: true, targetAudience: "COACHING_CENTRE" },
      orderBy: { basePrice: "asc" },
    }),
  ]);

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div
        className="absolute top-[-120px] right-[60px] w-[640px] h-[640px] pointer-events-none animate-glow"
        style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--primary) 10%, transparent), transparent 62%)" }}
      />

      <CoachingHeader />

      <main className="relative mx-auto max-w-[1100px] px-6 lg:px-10 py-8 pb-[120px]">
        <Link
          href="/coaching/dashboard"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to dashboard
        </Link>

        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Billing</p>
        <h1 className="mt-1 font-display text-3xl md:text-4xl">Plan &amp; payment</h1>

        <BillingClient
          state={{
            ...state,
            expiresAt: state.expiresAt?.toISOString() ?? null,
          }}
          plans={plans.map((p) => ({
            id: p.id,
            name: p.name,
            pricingModel: p.pricingModel,
            basePrice: Number(p.basePrice),
            durationDays: p.durationDays,
            featuresJson: p.featuresJson,
          }))}
        />
      </main>
    </div>
  );
}
