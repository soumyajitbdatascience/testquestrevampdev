import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError, success } from "@/lib/api-utils";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth("student");
    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get("limit") || "20")));
    const offset = (page - 1) * limit;

    const rows = await prisma.$queryRaw<Array<{
      id: number;
      status: number;
      isPractice: number | boolean;
      score: unknown;
      totalMarks: unknown;
      percentage: unknown;
      timeSpentSeconds: number | null;
      startedAt: Date | null;
      finishedAt: Date | null;
      testId: number;
      testName: string | null;
      subjectName: string | null;
      className: string | null;
    }>>`
      SELECT
        a.id, a.testId, a.score, a.totalMarks, a.percentage,
        a.timeSpentSeconds, a.startedAt, a.finishedAt,
        a.isPractice,
        a.status,
        t.name AS testName,
        c.name AS className,
        s.name AS subjectName
      FROM vw_attempts_legacy a
      LEFT JOIN vw_tests t ON t.id = a.testId
      LEFT JOIN vw_classes c ON c.id = t.classId
      LEFT JOIN vw_subjects s ON s.id = t.subjectId
      WHERE a.studentId = ${session.id}
      ORDER BY a.startedAt DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const totalRow = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
      SELECT COUNT(*) AS cnt FROM vw_attempts_legacy WHERE studentId = ${session.id}
    `;
    const total = Number(totalRow[0]?.cnt ?? 0);

    return success({
      attempts: rows.map(r => ({
        id: Number(r.id),
        status: r.status === 2 ? "LEGACY_COMPLETED" : "IN_PROGRESS",
        isPractice: !!r.isPractice,
        score: Number(r.score ?? 0),
        totalMarks: Number(r.totalMarks ?? 0),
        percentage: Number(r.percentage ?? 0),
        timeSpentSeconds: Number(r.timeSpentSeconds ?? 0),
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
        test: {
          id: Number(r.testId),
          name: r.testName ?? `Test ${Number(r.testId)}`,
          subject: { name: r.subjectName ?? "" },
          class: { name: r.className ?? "" },
        },
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
