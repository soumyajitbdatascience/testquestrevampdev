import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success } from "@/lib/api-utils";
import { planRowSchema, writeRowsPricing } from "@/lib/admin-pricing";

/**
 * Plans & pricing grid (design 2e): rows = board+class combos, columns = the
 * 3/6/12 prices.
 *
 * A row is priceable when the board+class has at least one **offering** — not
 * when it has tests. Launch Readiness counts every active offering, so greying
 * a shelf that has chapters and questions but no test yet would leave it
 * permanently red with no way to fix it from here.
 *
 * Cells report their stored price even when the term is inactive. Hiding it was
 * how a priced-but-off plan silently blocked readiness: the grid looked empty,
 * so nobody re-saved it.
 */
export async function GET() {
  try {
    await requireAuth("admin");

    const [boards, classes, offerings, plans] = await Promise.all([
      prisma.board.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
      prisma.class.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
      // Content is per board+class, not per class: CBSE Class 10 can be full
      // while ICSE Class 10 is empty, and the grid must grey the right cells.
      prisma.offering.findMany({
        where: { isActive: true },
        select: { boardId: true, classId: true, _count: { select: { tests: true } } },
      }),
      prisma.b2cPlan.findMany({ where: { subjectId: null } }),
    ]);

    const testsByScope = new Map<string, number>();
    const offeringsByScope = new Map<string, number>();
    for (const o of offerings) {
      const key = `${o.boardId}:${o.classId}`;
      testsByScope.set(key, (testsByScope.get(key) ?? 0) + o._count.tests);
      offeringsByScope.set(key, (offeringsByScope.get(key) ?? 0) + 1);
    }
    const planMap = new Map(plans.map((p) => [`${p.boardId}:${p.classId}:${p.durationMonths}`, p]));

    const rows = [];
    for (const b of boards) {
      for (const c of classes) {
        const get = (d: number) => {
          const pl = planMap.get(`${b.id}:${c.id}:${d}`);
          return pl ? { price: Number(pl.price), isActive: pl.isActive } : null;
        };
        const scope = `${b.id}:${c.id}`;
        const offeringCount = offeringsByScope.get(scope) ?? 0;
        rows.push({
          boardId: b.id,
          boardName: b.name,
          boardCode: b.code,
          classId: c.id,
          className: c.name,
          offeringCount,
          testCount: testsByScope.get(scope) ?? 0,
          hasContent: offeringCount > 0,
          prices: { 3: get(3), 6: get(6), 12: get(12) },
        });
      }
    }
    return success(rows);
  } catch (err) {
    return handleApiError(err);
  }
}

/** Saves one row's three terms. Bulk actions go through `POST /bulk`. */
export async function PUT(request: Request) {
  try {
    await requireAuth("admin");
    const body = await parseBody(request, planRowSchema);

    await writeRowsPricing([body]);
    return success({ saved: true });
  } catch (err) {
    return handleApiError(err);
  }
}
