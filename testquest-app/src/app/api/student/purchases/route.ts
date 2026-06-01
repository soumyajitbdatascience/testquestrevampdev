import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, success } from "@/lib/api-utils";
import { findTestsByIds } from "@/lib/legacy-lookups";

export async function GET() {
  try {
    const session = await requireAuth("student");

    const [orders, access] = await Promise.all([
      prisma.order.findMany({
        where: { studentId: session.id },
        include: {
          bundle: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),

      prisma.studentAccess.findMany({
        where: { studentId: session.id },
      }),
    ]);

    // Hydrate test names from vw_tests for both orders (TEST type) and access rows.
    const testIds = Array.from(new Set([
      ...orders.flatMap((o) => (o.itemType === "TEST" && o.testId ? [o.testId] : [])),
      ...access.map((a) => a.testId),
    ]));
    const testMap = await findTestsByIds(testIds);

    const activeAccess = access.filter((a) => !a.expiresAt || a.expiresAt > new Date());
    const expiredAccess = access.filter((a) => a.expiresAt && a.expiresAt <= new Date());

    const ordersOut = orders.map((o) => ({
      ...o,
      test: o.testId ? (testMap.get(o.testId) ? { id: o.testId, name: testMap.get(o.testId)!.name } : null) : null,
    }));

    return success({
      orders: ordersOut,
      access: {
        active: activeAccess.map((a) => {
          const t = testMap.get(a.testId);
          return {
            testId: a.testId,
            testName: t?.name ?? null,
            subject: t?.subjectName ?? null,
            expiresAt: a.expiresAt,
          };
        }),
        expired: expiredAccess.map((a) => {
          const t = testMap.get(a.testId);
          return {
            testId: a.testId,
            testName: t?.name ?? null,
            subject: t?.subjectName ?? null,
            expiredAt: a.expiresAt,
          };
        }),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
