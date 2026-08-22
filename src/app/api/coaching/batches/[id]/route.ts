/**
 * Batch detail endpoints — Task 1.7.
 *
 *   GET    /api/coaching/batches/[id]   — full detail (students + assignments)
 *   PATCH  /api/coaching/batches/[id]   — edit name / subjects / archive
 *
 * Auth: any active OrgMembership of the parent org may read. Writes are
 * limited to OWNER + ADMIN.
 *
 * Students/assignment removal lives at /students/[studentId]/route.ts.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgRole } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name:        z.string().min(1).max(200).optional(),
  board:       z.string().min(1).max(50).optional(),
  subjects:    z.array(z.string().min(1).max(80)).max(20).optional(),
  isActive:    z.boolean().optional(),
});

async function loadBatchOrThrow(id: number, orgId: number) {
  const b = await prisma.batch.findUnique({
    where: { id },
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
  if (!b || b.orgId !== orgId) throw new Error("Not found");
  return b;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN", "TEACHER", "STUDENT"]);
    const { id } = await params;
    const batchId = Number(id);
    if (!Number.isFinite(batchId)) return error("Bad batch id", 400);

    const batch = await loadBatchOrThrow(batchId, session.orgId!);

    // Hydrate class name + student info + per-student avg score, in batch
    const studentIds = batch.enrollments.map((e) => e.studentId);
    const [classRow, students, scoreRows, lastAttemptRows] = await Promise.all([
      batch.classId
        ? prisma.$queryRaw<Array<{ name: string }>>`SELECT name FROM vw_classes WHERE id = ${batch.classId} LIMIT 1`
        : Promise.resolve([] as Array<{ name: string }>),
      studentIds.length
        ? prisma.$queryRawUnsafe<Array<{ id: number; name: string; email: string; mobile: string | null }>>(
            `SELECT id, name, email, mobile FROM vw_students WHERE id IN (${studentIds.map(() => "?").join(",")})`,
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
    ]);

    const scoreByStudent = new Map(
      scoreRows.map((r) => {
        const totalScore = Number(r.totalScore ?? 0);
        const totalMarks = Number(r.totalMarks ?? 0);
        const avg = totalMarks > 0 ? Math.round((totalScore / totalMarks) * 100) : null;
        return [Number(r.studentId), { avgScore: avg, attempts: Number(r.attempts ?? 0) }];
      }),
    );
    const lastByStudent = new Map(lastAttemptRows.map((r) => [Number(r.studentId), r.finishedAt]));
    const studentById = new Map(students.map((s) => [Number(s.id), s]));

    return success({
      id: batch.id,
      name: batch.name,
      classId: batch.classId,
      className: classRow[0]?.name ?? null,
      board: batch.board,
      subjects: batch.subjectsCsv.split(",").map((s) => s.trim()).filter(Boolean),
      isActive: batch.isActive,
      createdAt: batch.createdAt,
      studentCount: batch.enrollments.length,
      students: batch.enrollments.map((e) => {
        const s = studentById.get(e.studentId);
        const score = scoreByStudent.get(e.studentId);
        return {
          enrollmentId: e.id,
          studentId: e.studentId,
          name: s?.name ?? "Unknown",
          email: s?.email ?? null,
          mobile: s?.mobile ?? null,
          enrolledAt: e.enrolledAt,
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
    });
  } catch (err) {
    if ((err as Error).message === "Not found") return error("Batch not found", 404);
    return handleApiError(err);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN"]);
    const { id } = await params;
    const batchId = Number(id);
    if (!Number.isFinite(batchId)) return error("Bad batch id", 400);

    const body = await parseBody(req, updateSchema);
    await loadBatchOrThrow(batchId, session.orgId!);

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.board !== undefined) data.board = body.board;
    if (body.subjects !== undefined) data.subjectsCsv = body.subjects.join(",");
    if (body.isActive !== undefined) data.isActive = body.isActive;

    const updated = await prisma.batch.update({ where: { id: batchId }, data });
    return success({ id: updated.id, name: updated.name, isActive: updated.isActive });
  } catch (err) {
    if ((err as Error).message === "Not found") return error("Batch not found", 404);
    return handleApiError(err);
  }
}
