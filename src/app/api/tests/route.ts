import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, success } from "@/lib/api-utils";
import { resolveAccessForTests } from "@/lib/access";
import { resolveActiveContext } from "@/lib/student-context";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Test catalogue, **scoped to the caller's active board+class**.
 *
 * This endpoint used to take `classId` / `boardId` as optional query params
 * and default to no filter at all, so an unauthenticated GET returned every
 * class's tests. That fail-open list is what the retired `/tests` browse-all
 * page rendered, and it is the one thing context scoping must never allow.
 *
 * Now: a student session is required, and the scope is taken from `tq_ctx`
 * rather than from the request. `subjectId` and `search` still narrow *within*
 * that scope; `classId`/`boardId` are no longer read, so there is no parameter
 * left that can widen it.
 *
 * The class home → subject → chapter path is the browse. This remains only for
 * in-scope lookups.
 *
 * Server-paginated: with 270 tests today and no ceiling on tomorrow, an
 * unbounded list is a page that eventually stops loading.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth("student");
    const params = request.nextUrl.searchParams;
    const subjectId = params.get("subjectId");
    const search = params.get("search");
    const page = Math.max(1, Number(params.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, Number(params.get("limit") || "20")));

    const ctx = await resolveActiveContext(session.id);
    // Fail closed: no context, no catalogue.
    if (!ctx) return success({ tests: [], total: 0, page, limit, hasMore: false });

    const where: Prisma.TestWhereInput = {
      isActive: true,
      offering: {
        isActive: true,
        boardId: ctx.boardId,
        classId: ctx.classId,
        ...(subjectId ? { subjectId: Number(subjectId) } : {}),
      },
      ...(search ? { name: { contains: search } } : {}),
    };

    const [tests, total] = await Promise.all([
      prisma.test.findMany({
        where,
        orderBy: [{ offeringId: "asc" }, { name: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, name: true, durationMinutes: true, totalMarks: true, isPractice: true,
          _count: { select: { questions: true } },
          freeTests: { select: { id: true } },
          offering: {
            select: {
              id: true,
              subject: { select: { id: true, name: true } },
              class: { select: { id: true, name: true } },
              board: { select: { id: true, code: true } },
            },
          },
        },
      }),
      prisma.test.count({ where }),
    ]);

    const studentId = session.id;
    const testIds = tests.map((t) => t.id);

    // Bulk access resolution (free sample / class pass / locked) — single
    // source of truth in src/lib/access.ts.
    const [accessMap, attempts] = await Promise.all([
      resolveAccessForTests(studentId, testIds),
      studentId && testIds.length > 0
        ? prisma.attempt.findMany({
            where: { studentId, testId: { in: testIds }, status: "COMPLETED" },
            orderBy: { finishedAt: "desc" },
            select: { testId: true, score: true, totalMarks: true },
          })
        : Promise.resolve([]),
    ]);

    const lastByTest = new Map<number, { score: number; percentage: number }>();
    for (const a of attempts) {
      if (lastByTest.has(a.testId)) continue;
      lastByTest.set(a.testId, {
        score: a.score,
        percentage: a.totalMarks > 0 ? Number(((a.score / a.totalMarks) * 100).toFixed(2)) : 0,
      });
    }

    return success({
      tests: tests.map((t) => {
        const access = accessMap.get(t.id) ?? { access: false, reason: "NONE" as const };
        return {
          id: t.id,
          name: t.name,
          durationMinutes: t.durationMinutes,
          totalMarks: t.totalMarks,
          questionCount: t._count.questions,
          isPractice: t.isPractice,
          isFreeSample: t.freeTests.length > 0,
          offeringId: t.offering.id,
          board: t.offering.board,
          class: t.offering.class,
          subject: t.offering.subject,
          locked: !access.access,
          accessReason: access.reason,
          lastAttempt: lastByTest.get(t.id) ?? null,
        };
      }),
      total,
      page,
      limit,
      hasMore: page * limit < total,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
