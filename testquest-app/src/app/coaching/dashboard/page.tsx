/**
 * /coaching/dashboard — centre owner's home.
 *
 * Task 1.6: real-data view. Reads everything via loadDashboard() and renders
 * via the UI_PLAN §4 component vocabulary: TrialBanner, StatTile, BatchListItem,
 * ActivityFeedItem, EmptyState. Matches UI_PLAN §5.1.4 layout.
 *
 * Phase 0.3 / Task 0.4 plumbing still applies: middleware gates /coaching/*;
 * server-component redirects below cover edge cases the middleware can't see
 * (e.g. STUDENT role members landing here).
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, Plus } from "lucide-react";
import { getSession } from "@/lib/auth";
import { loadDashboard } from "@/lib/services/dashboard.service";
import { readSetupProgress, readOnboardingDismissed } from "@/lib/services/batch.service";
import { resolveSubscriptionState } from "@/lib/services/subscription.service";
import { prisma } from "@/lib/db";
import { CoachingHeader } from "@/components/coaching/coaching-header";
import { TrialBanner } from "@/components/coaching/trial-banner";
import { StatTile } from "@/components/coaching/stat-tile";
import { BatchListItem } from "@/components/coaching/batch-list-item";
import { ActivityFeedItem } from "@/components/coaching/activity-feed-item";
import { EmptyState } from "@/components/coaching/empty-state";
import { OnboardingTip } from "@/components/coaching/onboarding-tip";
import { SampleDataBanner } from "@/components/coaching/sample-data-banner";
import { getSampleData } from "@/lib/services/sample-data.service";
import { BulkReminderButton } from "@/components/coaching/bulk-reminder-button";

export const dynamic = "force-dynamic";

export default async function CoachingDashboardPage() {
  const session = await getSession();
  if (!session || !session.orgId) redirect("/coaching/login");
  if (session.orgRole === "STUDENT") redirect("/tests");

  // If this owner hasn't finished the setup wizard yet, push them through it.
  if (session.orgRole === "OWNER") {
    const progress = await readSetupProgress(session.orgId);
    const hasActiveProgress = progress.completedSteps.length > 0 && !progress.completedSteps.includes(5);
    if (hasActiveProgress) redirect("/coaching/setup");
  }

  const [data, billing, onboardingDismissed, teamCount, sampleData, branchCount] = await Promise.all([
    loadDashboard(session.orgId),
    resolveSubscriptionState(session.orgId),
    readOnboardingDismissed(session.orgId),
    prisma.orgMembership.count({
      where: {
        orgId: session.orgId,
        isActive: true,
        role: { in: ["OWNER", "ADMIN", "TEACHER"] },
      },
    }),
    getSampleData(session.orgId),
    // Task 4.4 — surface a Branches link in the header only when this org
    // actually parents one or more child orgs. Hidden to TEACHER (TEACHER
    // doesn't cascade and never needs the multi-branch view).
    session.orgRole === "OWNER" || session.orgRole === "ADMIN"
      ? prisma.organization.count({ where: { parentOrgId: session.orgId } })
      : Promise.resolve(0),
  ]);
  const hasSampleData = sampleData !== null;

  // Task 2.1 — owner-as-teacher collapse: while the centre has just one
  // teammate (the owner alone), hide role copy. The Team link still shows for
  // the OWNER so they can find the invite flow.
  const hasTeammates = teamCount > 1;
  const showTeamLink = session.orgRole === "OWNER" || hasTeammates;
  const headerRole = hasTeammates ? session.orgRole : null;

  const onboardingVariant: "create-batch" | "assign-test" | "all-set" | null =
    onboardingDismissed
      ? null
      : data.batches.length === 0
        ? "create-batch"
        : data.activity.length === 0
          ? "assign-test"
          : "all-set";

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();
  const firstName = data.ownerName?.split(" ")[0] ?? "";

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div
        className="absolute top-[-120px] right-[60px] w-[640px] h-[640px] pointer-events-none animate-glow"
        style={{ background: "radial-gradient(circle, oklch(0.76 0.17 72 / 0.10), transparent 62%)" }}
      />

      <CoachingHeader
        orgName={data.orgName}
        role={headerRole}
        showTeamLink={showTeamLink}
        showTestsLink
        showQuestionsLink
        showSettingsLink={session.orgRole === "OWNER" || session.orgRole === "ADMIN"}
        showHelpLink
        branchCount={branchCount}
      />

      <main className="relative mx-auto max-w-[1280px] px-6 lg:px-10 py-10">
        {/* Trial / lifecycle banner driven by resolveSubscriptionState. */}
        {billing.banner !== "none" && (
          <div className="mb-8">
            <TrialBanner
              banner={billing.banner}
              daysLeft={billing.daysLeft}
              planName={billing.planName}
            />
          </div>
        )}

        {hasSampleData && <SampleDataBanner />}

        {onboardingVariant && <OnboardingTip variant={onboardingVariant} />}

        {/* Greeting row */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              {greeting}{firstName && `, ${firstName}`}
            </p>
            <h1 className="mt-1 font-display text-4xl md:text-5xl">{data.orgName}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {data.orgCity ?? "—"}
              {hasTeammates && (
                <>
                  {" "}· You&apos;re signed in as <span className="text-foreground">{session.orgRole}</span>.
                </>
              )}
            </p>
          </div>
          <Link
            href="/coaching/batches/new"
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-strong px-4 py-2.5 text-sm text-foreground hover:bg-white/5 transition-colors self-start md:self-auto"
          >
            <Plus className="h-4 w-4" />
            New batch
          </Link>
        </div>

        {/* Stat tile grid */}
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile label="Students"     value={data.stats.totalStudents} />
          <StatTile label="Active batches" value={data.stats.activeBatches} />
          <StatTile label="Assigned this week" value={data.stats.assignmentsThisWeek} />
          <StatTile
            label="Avg score"
            value={data.stats.averageScore != null ? `${data.stats.averageScore}%` : "—"}
            accent={data.stats.averageScore != null}
          />
        </div>

        {/* Body: batches + activity */}
        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* Batch list */}
          <section>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-display text-xl">Batches</h2>
              {data.batches.length >= 12 && (
                <span className="text-xs text-muted-foreground">showing 12</span>
              )}
            </div>

            {data.batches.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Create your first batch."
                body="Group your students by class or timing. You'll assign tests to whole batches at once."
                ctaLabel="Create batch"
                ctaHref="/coaching/batches/new"
              />
            ) : (
              <div className="space-y-3">
                {data.batches.map((b) => (
                  <BatchListItem
                    key={b.id}
                    id={b.id}
                    name={b.name}
                    className={b.className}
                    board={b.board}
                    studentCount={b.studentCount}
                    subjects={b.subjects}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Activity feed */}
          <aside>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-display text-xl">Recent activity</h2>
              {data.activity.length > 0 && (
                <span className="text-xs text-muted-foreground">last 10</span>
              )}
            </div>
            {(session.orgRole === "OWNER" || session.orgRole === "ADMIN") && (
              <div className="mb-4">
                <BulkReminderButton scope="this-week" />
              </div>
            )}
            {data.activity.length === 0 ? (
              <div className="rounded-[14px] border bg-surface px-5 py-6 text-sm text-muted-foreground">
                No activity yet. As your students take tests, you'll see their completions here.
              </div>
            ) : (
              <div className="rounded-[14px] border bg-surface divide-y px-3">
                {data.activity.map((a) => (
                  <ActivityFeedItem
                    key={a.attemptId}
                    studentName={a.studentName}
                    testName={a.testName}
                    percentage={a.percentage}
                    finishedAt={a.finishedAt}
                  />
                ))}
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
