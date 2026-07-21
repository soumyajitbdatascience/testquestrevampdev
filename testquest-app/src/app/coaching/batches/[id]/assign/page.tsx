/**
 * /coaching/batches/[id]/assign — assign test flow (Task 1.8).
 *
 * Server shell: validates org/batch scope + auth, fetches the batch context,
 * hands off to <AssignClient/> which owns the picker + schedule + commit.
 */
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CoachingHeader } from "@/components/coaching/coaching-header";
import { AssignClient } from "./assign-client";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function AssignPage({ params }: Params) {
  const session = await getSession();
  if (!session || !session.orgId) redirect("/coaching/login");
  if (session.orgRole !== "OWNER" && session.orgRole !== "ADMIN") redirect("/coaching/dashboard");

  const { id } = await params;
  const batchId = Number(id);
  if (!Number.isFinite(batchId)) notFound();

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: {
      _count: { select: { enrollments: { where: { isActive: true } } } },
    },
  });
  if (!batch || batch.orgId !== session.orgId) notFound();

  // Pull class name for header context.
  const cls = batch.classId
    ? await prisma.$queryRaw<Array<{ name: string }>>`SELECT name FROM vw_classes WHERE id = ${batch.classId} LIMIT 1`
    : [];

  const subjects = batch.subjectsCsv.split(",").map((s) => s.trim()).filter(Boolean);

  // Task 5.3.1 — load OTHER active batches in this org so the owner can
  // bulk-assign in one click. Pattern mirrors transferTargets in
  // /coaching/batches/[id]/page.tsx.
  const otherBatchRows = await prisma.batch.findMany({
    where: { orgId: session.orgId!, id: { not: batchId }, isActive: true },
    select: { id: true, name: true, classId: true },
    orderBy: { name: "asc" },
  });
  const otherClassIds = Array.from(
    new Set(otherBatchRows.map((b) => b.classId).filter((x): x is number => x != null)),
  );
  let classNameById = new Map<number, string>();
  if (otherClassIds.length > 0) {
    const classRows = await prisma.$queryRawUnsafe<Array<{ id: number; name: string }>>(
      `SELECT id, name FROM vw_classes WHERE id IN (${otherClassIds.map(() => "?").join(",")})`,
      ...otherClassIds,
    );
    classNameById = new Map(classRows.map((c) => [Number(c.id), c.name]));
  }
  const otherBatches = otherBatchRows.map((b) => ({
    id: b.id,
    name: b.name,
    className: b.classId ? classNameById.get(b.classId) ?? null : null,
  }));

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div
        className="absolute top-[-120px] right-[60px] w-[640px] h-[640px] pointer-events-none animate-glow"
        style={{ background: "radial-gradient(circle, color-mix(in oklab, var(--primary) 8%, transparent), transparent 62%)" }}
      />

      <CoachingHeader />

      <main className="relative mx-auto max-w-[1280px] px-6 lg:px-10 py-8 pb-[140px]">
        <Link
          href={`/coaching/batches/${batchId}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to batch
        </Link>

        <div className="mb-6">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Assign test</p>
          <h1 className="mt-1 font-display text-3xl md:text-4xl">{batch.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {(cls[0]?.name ?? "—")} · {batch.board} · {batch._count.enrollments} {batch._count.enrollments === 1 ? "student" : "students"}
          </p>
        </div>

        <AssignClient
          batchId={batchId}
          batchName={batch.name}
          classId={batch.classId ?? 0}
          batchSubjects={subjects}
          enrolledCount={batch._count.enrollments}
          otherBatches={otherBatches}
        />
      </main>
    </div>
  );
}
