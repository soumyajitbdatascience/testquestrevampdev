/**
 * /coaching/batches/[id]/assignments/[assignmentId]
 * Owner / Admin / Teacher live monitoring view (Task 1.10, UI_PLAN §5.1.7).
 *
 * Server shell delegates to <MonitorClient/> which fetches results from
 * /api/coaching/assignments/[id]/results and lets the owner fire the
 * "Send reminder" bulk action.
 */
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CoachingHeader } from "@/components/coaching/coaching-header";
import { MonitorClient } from "./monitor-client";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; assignmentId: string }> };

export default async function MonitorPage({ params }: Params) {
  const session = await getSession();
  if (!session || !session.orgId) redirect("/coaching/login");
  if (session.orgRole === "STUDENT") redirect("/tests");

  const { id, assignmentId } = await params;
  const batchId = Number(id);
  const aId = Number(assignmentId);
  if (!Number.isFinite(batchId) || !Number.isFinite(aId)) notFound();

  // Verify assignment belongs to this batch + this org (server-side guard).
  const a = await prisma.assignment.findUnique({
    where: { id: aId },
    select: { orgId: true, batchId: true, title: true },
  });
  if (!a || a.orgId !== session.orgId || a.batchId !== batchId) notFound();

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
          href={`/coaching/batches/${batchId}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to batch
        </Link>
        <MonitorClient assignmentId={aId} />
      </main>
    </div>
  );
}
