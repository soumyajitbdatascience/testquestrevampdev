/**
 * /coaching/branches — Task 4.4.
 *
 * Multi-branch console for OWNER/ADMIN of a parent org. Lists every child org
 * (rows where parentOrgId === this org), shows headcount + subscription state,
 * and offers "Enter" to switch into the child org's coaching workspace.
 *
 * If the current org has no children, we bounce back to /coaching/dashboard
 * since there's nothing to manage here yet.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Building2 } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listBranches } from "@/lib/services/organization-hierarchy.service";
import { CoachingHeader } from "@/components/coaching/coaching-header";
import { EnterBranchButton } from "./enter-branch-button";

export const dynamic = "force-dynamic";

export default async function BranchesPage() {
  const session = await getSession();
  if (!session || !session.orgId) redirect("/coaching/login");
  if (session.orgRole !== "OWNER" && session.orgRole !== "ADMIN") {
    redirect("/coaching/dashboard");
  }

  const branches = await listBranches(session.orgId);
  if (branches.length === 0) redirect("/coaching/dashboard");

  const parent = await prisma.organization.findUnique({
    where: { id: session.orgId },
    select: { name: true },
  });

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <CoachingHeader
        orgName={parent?.name ?? null}
        role={session.orgRole}
        showTestsLink
        showQuestionsLink
        showTeamLink
        showSettingsLink
        showHelpLink
      />

      <main className="relative mx-auto max-w-[1100px] px-6 lg:px-10 py-10">
        <Link
          href="/coaching/dashboard"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to dashboard
        </Link>

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Branches</p>
            <h1 className="mt-1 font-display text-4xl md:text-5xl">Your centres</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {branches.length} branch{branches.length === 1 ? "" : "es"} under {parent?.name ?? "this org"}.
            </p>
          </div>
          <Link
            href="/coaching/branches/new"
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-strong px-4 py-2.5 text-sm hover:bg-white/5 transition-colors self-start md:self-auto"
          >
            <Plus className="h-4 w-4" />
            Add branch
          </Link>
        </div>

        <div className="rounded-[14px] border bg-surface divide-y">
          {branches.map((b) => (
            <div key={b.id} className="flex items-center gap-3 px-5 py-4">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary-dim text-primary shrink-0">
                <Building2 className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{b.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {b.city ?? "—"} · {b.memberCount} members · {b.batchCount} batches
                </p>
              </div>
              {b.subscriptionStatus && (
                <span className="text-[10px] uppercase tracking-widest rounded-full bg-surface-hi px-2.5 py-1">
                  {b.subscriptionStatus}
                  {b.subscriptionPlanName ? ` · ${b.subscriptionPlanName}` : ""}
                </span>
              )}
              <EnterBranchButton orgId={b.id} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
