import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import { prisma } from "@/lib/db";
import { resolveActiveContext } from "@/lib/student-context";

/**
 * Attempt history, newest first. Server-paginated — history only grows.
 *
 * Scoped to the active board+class: this list is the "Recent attempts"
 * section of My progress, and a student switched to Class 7 seeing Class 6
 * papers would be the same cross-class leak the browse-all page had.
 *
 * `?offeringId=` narrows *within* that scope, for the subject pills that
 * filter the trend and this list together. It can only ever narrow: the
 * context filter is applied regardless, so an offering id belonging to another
 * class intersects to nothing rather than widening the result. That is the
 * fail-closed shape — an unowned id returns an empty page, never someone
 * else's papers.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth("student");
    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get("limit") || "20")));

    const ctx = await resolveActiveContext(session.id);
    // No context means nothing to be in scope of — an empty page, not all of it.
    if (!ctx) return success({ attempts: [], total: 0, page, totalPages: 0 });

    const rawOffering = request.nextUrl.searchParams.get("offeringId");
    const offeringId = rawOffering ? Number(rawOffering) : null;
    if (rawOffering && !Number.isFinite(offeringId)) return error("Invalid offeringId", 400);

    const where = {
      studentId: session.id,
      test: {
        offering: {
          boardId: ctx.boardId,
          classId: ctx.classId,
          ...(offeringId != null ? { id: offeringId } : {}),
        },
      },
    };
    const [rows, total] = await Promise.all([
      prisma.attempt.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, testId: true, status: true, score: true, totalMarks: true,
          timeSpentSeconds: true, startedAt: true, finishedAt: true,
          test: {
            select: {
              name: true, isPractice: true,
              offering: {
                select: {
                  id: true,
                  subject: { select: { name: true } },
                  class: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
      prisma.attempt.count({ where }),
    ]);

    return success({
      attempts: rows.map((r) => ({
        id: r.id,
        status: r.status,
        isPractice: r.test.isPractice,
        score: r.score,
        totalMarks: r.totalMarks,
        percentage: r.totalMarks > 0 ? Number(((r.score / r.totalMarks) * 100).toFixed(2)) : 0,
        timeSpentSeconds: r.timeSpentSeconds,
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
        test: {
          id: r.testId,
          name: r.test.name,
          offeringId: r.test.offering.id,
          subject: { name: r.test.offering.subject.name },
          class: { name: r.test.offering.class.name },
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
