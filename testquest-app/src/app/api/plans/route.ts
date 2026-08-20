import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import { currentExpiry } from "@/lib/access";
import { resolvePlanPricing, type PlanRow, type PlanDuration } from "@/lib/pricing";

/**
 * Plans for the paywall: active 3/6/12-month prices for a board+class, plus
 * the real content counts for the summary line ("All 5 subjects · 142 tests ·
 * 56 video lessons") and — when signed in — the current pass expiry so the
 * sheet can say "days add on after {date}".
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const boardId = Number(params.get("boardId"));
    const classId = Number(params.get("classId"));
    if (!Number.isFinite(boardId) || !Number.isFinite(classId)) {
      return error("boardId and classId are required", 400);
    }

    // Prices go through the same fail-closed resolver the admin grid and
    // checkout use, so the sheet can only ever show a term that is genuinely
    // buyable — a zero-priced or deactivated term simply isn't offered.
    const rows = await prisma.b2cPlan.findMany({
      where: { boardId, classId, subjectId: null },
      orderBy: { durationMonths: "asc" },
      select: { id: true, boardId: true, classId: true, durationMonths: true, price: true, isActive: true },
    });
    const pricing = resolvePlanPricing(
      rows.map((r): PlanRow => ({
        boardId: r.boardId, classId: r.classId, durationMonths: r.durationMonths,
        price: Number(r.price), isActive: r.isActive,
      })),
      { boardId, classId },
    );
    const plans = rows
      .filter((r) => pricing.byDuration[r.durationMonths as PlanDuration] != null && r.isActive)
      .map((r) => ({
        id: r.id,
        durationMonths: r.durationMonths,
        price: pricing.byDuration[r.durationMonths as PlanDuration] as number,
      }));

    // Content counts, on the offering model (the vw_* views are gone).
    //
    // `freeSampleCount` is counted, not inferred. "One free test per subject"
    // is the policy, not a guarantee: some offerings carry no sample yet, so
    // deriving the number from `subjectCount` would promise papers that do not
    // exist. The add-class sheet drops the "try n free tests" clause entirely
    // when this is zero.
    const [subjectCount, testCount, videoCount, freeSampleCount] = await Promise.all([
      prisma.offering.count({ where: { boardId, classId, isActive: true } }),
      prisma.test.count({ where: { isActive: true, offering: { boardId, classId, isActive: true } } }),
      prisma.video.count({ where: { isActive: true, offering: { boardId, classId } } }),
      prisma.freeTest.count({
        where: { offering: { boardId, classId, isActive: true }, test: { isActive: true } },
      }),
    ]);

    const session = await getSession();
    let passExpiresAt: Date | null = null;
    if (session?.role === "student") {
      const exp = await currentExpiry(session.id, boardId, classId);
      if (exp && exp > new Date()) passExpiresAt = exp;
    }

    const [board, cls] = await Promise.all([
      prisma.board.findUnique({ where: { id: boardId }, select: { name: true, code: true } }),
      prisma.class.findUnique({ where: { id: classId }, select: { name: true } }),
    ]);

    return success({
      boardName: board?.name ?? "",
      className: cls?.name ?? `Class ${classId}`,
      plans,
      counts: { subjects: subjectCount, tests: testCount, videos: videoCount },
      freeSampleCount,
      passExpiresAt,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
