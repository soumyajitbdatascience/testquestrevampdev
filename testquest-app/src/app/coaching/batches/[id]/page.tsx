/**
 * /coaching/batches/[id] — batch detail (Task 1.7).
 *
 * Server-component shell: enforces org membership + correct org-scope for the
 * batch, fetches the full detail payload via the same shape the GET API
 * returns, and hands off to the client BatchClient for the tabbed UI.
 */
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CoachingHeader } from "@/components/coaching/coaching-header";
import { BatchClient, type BatchDetail, type TransferTarget } from "./batch-client";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function BatchDetailPage({ params }: Params) {
  const session = await getSession();
  if (!session || !session.orgId) redirect("/coaching/login");
  if (session.orgRole === "STUDENT") redirect("/tests");

  const { id } = await params;
  const batchId = Number(id);
  if (!Number.isFinite(batchId)) notFound();

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: {
      enrollments: {
        where: { isActive: true },
        select: { id: true, studentId: true, enrolledAt: true },
      },
      assignments: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!batch || batch.orgId !== session.orgId) notFound();

  const studentIds = batch.enrollments.map((e) => e.studentId);

  const [classRow, students, scoreRows, lastAttemptRows, org] = await Promise.all([
    batch.classId
      ? prisma.$queryRaw<Array<{ name: string }>>`SELECT name FROM vw_classes WHERE id = ${batch.classId} LIMIT 1`
      : Promise.resolve([] as Array<{ name: string }>),
    studentIds.length
      ? prisma.$queryRawUnsafe<Array<{ id: number; name: string; mobile: string | null }>>(
          `SELECT id, name, mobile FROM vw_students WHERE id IN (${studentIds.map(() => "?").join(",")})`,
          ...studentIds,
        )
      : Promise.resolve([]),
    studentIds.length
      ? prisma.$queryRawUnsafe<Array<{ studentId: number; totalScore: number | null; totalMarks: number | null; attempts: bigint }>>(
          `SELECT studentId, SUM(score) AS totalScore, SUM(totalMarks) AS totalMarks, COUNT(*) AS attempts
           FROM vw_attempts_legacy
           WHERE studentId IN (${studentIds.map(() => "?").join(",")})
             AND finishedAt IS NOT NULL AND totalMarks > 0
           GROUP BY studentId`,
          ...studentIds,
        )
      : Promise.resolve([]),
    studentIds.length
      ? prisma.$queryRawUnsafe<Array<{ studentId: number; finishedAt: Date }>>(
          `SELECT studentId, MAX(finishedAt) AS finishedAt
           FROM vw_attempts_legacy
           WHERE studentId IN (${studentIds.map(() => "?").join(",")}) AND finishedAt IS NOT NULL
           GROUP BY studentId`,
          ...studentIds,
        )
      : Promise.resolve([]),
    prisma.organization.findUnique({
      where: { id: session.orgId! },
      select: { name: true },
    }),
  ]);

  const studentById = new Map(students.map((s) => [Number(s.id), s]));
  const scoreByStudent = new Map(
    scoreRows.map((r) => {
      const totalScore = Number(r.totalScore ?? 0);
      const totalMarks = Number(r.totalMarks ?? 0);
      const avg = totalMarks > 0 ? Math.round((totalScore / totalMarks) * 100) : null;
      return [Number(r.studentId), { avgScore: avg, attempts: Number(r.attempts ?? 0) }];
    }),
  );
  const lastByStudent = new Map(lastAttemptRows.map((r) => [Number(r.studentId), r.finishedAt]));

  const detail: BatchDetail = {
    id: batch.id,
    orgName: org?.name ?? "",
    name: batch.name,
    classId: batch.classId,
    className: classRow[0]?.name ?? null,
    board: batch.board,
    subjects: batch.subjectsCsv.split(",").map((s) => s.trim()).filter(Boolean),
    isActive: batch.isActive,
    studentCount: batch.enrollments.length,
    students: batch.enrollments.map((e) => {
      const s = studentById.get(e.studentId);
      const score = scoreByStudent.get(e.studentId);
      return {
        studentId: e.studentId,
        name: s?.name ?? "Unknown",
        mobile: s?.mobile ?? null,
        avgScore: score?.avgScore ?? null,
        attempts: score?.attempts ?? 0,
        lastAttemptAt: lastByStudent.get(e.studentId) ?? null,
      };
    }),
    assignments: batch.assignments.map((a) => ({
      id: a.id,
      title: a.title,
      testId: a.testId,
      dueAt: a.dueAt,
      createdAt: a.createdAt,
      isActive: a.isActive,
    })),
  };

  const canManage = session.orgRole === "OWNER" || session.orgRole === "ADMIN";
  // Task 3.3: TEACHER may not edit the batch but can still dispatch parent
  // reports for students in batches they have access to. Anyone non-STUDENT
  // qualifies (STUDENT was redirected above).
  const canSendReport =
    session.orgRole === "OWNER" ||
    session.orgRole === "ADMIN" ||
    session.orgRole === "TEACHER";
  // Task 4.5: load other active batches in this org for the transfer picker.
  // Only OWNER/ADMIN can transfer; TEACHER sees no transfer option.
  const canTransfer = canManage;
  let transferTargets: TransferTarget[] = [];
  if (canTransfer) {
    const otherBatches = await prisma.batch.findMany({
      where: { orgId: session.orgId!, id: { not: batchId }, isActive: true },
      select: { id: true, name: true, classId: true },
      orderBy: { name: "asc" },
    });
    const otherClassIds = Array.from(new Set(otherBatches.map((b) => b.classId).filter((x): x is number => x != null)));
    let classNameById = new Map<number, string>();
    if (otherClassIds.length > 0) {
      const classRows = await prisma.$queryRawUnsafe<Array<{ id: number; name: string }>>(
        `SELECT id, name FROM vw_classes WHERE id IN (${otherClassIds.map(() => "?").join(",")})`,
        ...otherClassIds,
      );
      classNameById = new Map(classRows.map((c) => [Number(c.id), c.name]));
    }
    transferTargets = otherBatches.map((b) => ({
      id: b.id,
      name: b.name,
      className: b.classId ? classNameById.get(b.classId) ?? null : null,
    }));
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div
        className="absolute top-[-120px] right-[60px] w-[640px] h-[640px] pointer-events-none animate-glow"
        style={{ background: "radial-gradient(circle, oklch(0.76 0.17 72 / 0.10), transparent 62%)" }}
      />

      <CoachingHeader orgName={detail.orgName} />

      <main className="relative mx-auto max-w-[1100px] px-6 lg:px-10 py-8 pb-[120px]">
        <Link
          href="/coaching/dashboard"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to dashboard
        </Link>
        <BatchClient
          initial={detail}
          canManage={canManage}
          canSendReport={canSendReport}
          canTransfer={canTransfer}
          transferTargets={transferTargets}
        />
      </main>
    </div>
  );
}
