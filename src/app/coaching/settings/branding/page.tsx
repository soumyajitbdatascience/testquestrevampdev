/**
 * /coaching/settings/branding — white-label settings (Task 3.4).
 *
 * Server shell:
 *  - Auth: OWNER / ADMIN only
 *  - Loads the current whiteLabel sub-object + subscription state
 *  - If the org is on Starter (and not in TRIAL), renders an upgrade card
 *    instead of the form. TRIAL orgs see the form so they can preview.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { getSession } from "@/lib/auth";
import { resolveSubscriptionState } from "@/lib/services/subscription.service";
import { readBranding, isWhiteLabelAllowed } from "@/lib/services/branding.service";
import { prisma } from "@/lib/db";
import { CoachingHeader } from "@/components/coaching/coaching-header";
import { BrandingSettingsClient } from "./branding-client";

export const dynamic = "force-dynamic";

export default async function BrandingSettingsPage() {
  const session = await getSession();
  if (!session || !session.orgId) redirect("/coaching/login");
  if (session.orgRole !== "OWNER" && session.orgRole !== "ADMIN") {
    redirect("/coaching/dashboard");
  }

  const [whiteLabel, billing, org, allowed] = await Promise.all([
    readBranding(session.orgId),
    resolveSubscriptionState(session.orgId),
    prisma.organization.findUnique({
      where: { id: session.orgId },
      select: { name: true },
    }),
    isWhiteLabelAllowed(session.orgId),
  ]);

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <CoachingHeader
        orgName={org?.name ?? null}
        role={session.orgRole}
        showTeamLink
        showTestsLink
        showQuestionsLink
        showSettingsLink
      />

      <main className="relative mx-auto max-w-[1280px] px-6 lg:px-10 py-10">
        <Link
          href="/coaching/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to dashboard
        </Link>

        <div className="mt-5 mb-8">
          <h1 className="font-display text-3xl md:text-4xl">White-label</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            Make Testquest feel like your centre. Set your logo and colours here — they
            appear on your students&apos; dashboards, reports, and emails.
          </p>
        </div>

        {allowed ? (
          <BrandingSettingsClient
            initial={whiteLabel}
            trialPreview={billing.status === "TRIAL"}
          />
        ) : (
          <UpgradeCard planName={billing.planName} />
        )}
      </main>
    </div>
  );
}

function UpgradeCard({ planName }: { planName: string | null }) {
  return (
    <div className="rounded-[14px] border bg-surface px-6 py-8 max-w-2xl">
      <div className="flex items-start gap-4">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary-dim text-primary shrink-0">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-xl">Available on Growth and Pro</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your centre is currently on the {planName ?? "Starter"} plan. Upgrade to
            Growth or Pro to brand the student experience with your centre&apos;s logo,
            colours, and support details.
          </p>
          <Link
            href="/coaching/billing"
            className="mt-5 inline-flex items-center gap-1.5 rounded-[10px] bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            See upgrade options
          </Link>
        </div>
      </div>
    </div>
  );
}
