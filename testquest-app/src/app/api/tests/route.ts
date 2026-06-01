import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { handleApiError, success } from "@/lib/api-utils";
import { listTests } from "@/lib/legacy-content";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const classId = params.get("classId");
    const subjectId = params.get("subjectId");
    const isFree = params.get("isFree");
    const search = params.get("search");
    const page = Math.max(1, Number(params.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, Number(params.get("limit") || "20")));

    // Org members hitting /tests as consumers (a teacher browsing during dev,
    // for example) shouldn't see other orgs' private tests, but should see
    // their own org's private tests. Everyone else gets the public catalogue.
    const session = await getSession();
    const visibility: { kind: "b2c" } | { kind: "org"; orgId: number } =
      session?.orgId ? { kind: "org", orgId: session.orgId } : { kind: "b2c" };

    const filters = {
      classId: classId ? Number(classId) : undefined,
      subjectId: subjectId ? Number(subjectId) : undefined,
      isFree: isFree === "true" ? true : isFree === "false" ? false : undefined,
      search: search || undefined,
      offset: (page - 1) * limit,
      limit,
      visibility,
    };

    const { tests, total } = await listTests(filters);

    // If a student is signed in, mark their owned/attempted tests
    const studentId = session?.role === "student" ? session.id : null;

    const accessSet = new Set<number>();
    const lastAttempts = new Map<number, { score: number; percentage: string | number }>();

    if (studentId && tests.length > 0) {
      const ids = tests.map(t => Number(t.id));
      // Owned (paid) — from new tq_student_access table.
      // Skip practice-test ids (>= 1M offset) because tq_student_access only
      // stores main-test ids and the FK constraint expects them.
      const mainTestIds = ids.filter(id => id < 1_000_000);
      if (mainTestIds.length > 0) {
        const accesses = await prisma.studentAccess.findMany({
          where: { studentId, testId: { in: mainTestIds } },
          select: { testId: true, expiresAt: true },
        });
        for (const a of accesses) {
          if (!a.expiresAt || a.expiresAt > new Date()) accessSet.add(a.testId);
        }
      }
      // Last attempt per test — from legacy view (since attempts are written to legacy tables)
      const placeholders = ids.map(() => "?").join(",");
      const attempts = await prisma.$queryRawUnsafe<Array<{
        testId: number; score: unknown; percentage: unknown; finishedAt: Date | null;
      }>>(
        `SELECT testId, score, percentage, finishedAt
         FROM vw_attempts_legacy
         WHERE studentId = ? AND testId IN (${placeholders})
         ORDER BY finishedAt DESC`,
        studentId, ...ids
      );
      for (const a of attempts) {
        const tid = Number(a.testId);
        if (!lastAttempts.has(tid)) {
          lastAttempts.set(tid, {
            score: Number(a.score ?? 0),
            percentage: Number(a.percentage ?? 0),
          });
        }
      }
    }

    const enriched = tests.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      durationMinutes: t.durationMinutes,
      totalMarks: t.totalMarks,
      isFree: t.isFree,
      price: t.price,
      isPractice: t.isPractice,
      questionCount: t.questionCount,
      class: t.classId ? { id: t.classId, name: t.className || `Class ${t.classId}` } : null,
      subject: t.subjectId ? { id: t.subjectId, name: t.subjectName || `Subject ${t.subjectId}` } : null,
      hasAccess: t.isFree || accessSet.has(t.id),
      lastAttempt: lastAttempts.get(t.id) || null,
    }));

    return success({ tests: enriched, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    return handleApiError(err);
  }
}
