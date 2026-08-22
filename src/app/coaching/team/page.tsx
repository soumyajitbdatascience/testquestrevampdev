/**
 * /coaching/team — Phase 2 / Task 2.1.
 *
 * Owner manages teammates here: invite new TEACHER/ADMIN, see pending invites,
 * revoke active memberships. TEACHER + ADMIN can view (read-only); STUDENT
 * gets bounced to /tests.
 *
 * The server shell loads the initial member + pending lists; the client takes
 * over for mutations.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { listMembers, listPendingInvites } from "@/lib/services/team.service";
import { CoachingHeader } from "@/components/coaching/coaching-header";
import { TeamClient } from "./team-client";

export const dynamic = "force-dynamic";

export default async function CoachingTeamPage() {
  const session = await getSession();
  if (!session || !session.orgId) redirect("/coaching/login");
  if (session.orgRole === "STUDENT" || session.orgRole === "PARENT") redirect("/dashboard");

  const [members, pending] = await Promise.all([
    listMembers(session.orgId),
    listPendingInvites(session.orgId),
  ]);

  // Serialize Date fields for the client boundary.
  const memberDtos = members.map((m) => ({ ...m, joinedAt: m.joinedAt.toISOString() }));
  const pendingDtos = pending.map((p) => ({
    ...p,
    invitedAt: p.invitedAt.toISOString(),
    expiresAt: p.expiresAt.toISOString(),
  }));

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <CoachingHeader />

      <main className="relative mx-auto max-w-[1100px] px-6 lg:px-10 py-8 pb-[120px]">
        <Link
          href="/coaching/dashboard"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to dashboard
        </Link>

        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Team</p>
        <h1 className="mt-1 font-display text-3xl md:text-4xl">Teachers &amp; admins</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-xl">
          Invite teachers to share batches with. They&apos;ll get an email link to set their password.
        </p>

        <TeamClient
          initialMembers={memberDtos}
          initialPending={pendingDtos}
          isOwner={session.orgRole === "OWNER"}
          selfUserId={session.id}
        />
      </main>
    </div>
  );
}
