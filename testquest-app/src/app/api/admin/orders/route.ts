import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, success } from "@/lib/api-utils";
import { findStudentsByIds, findTestsByIds } from "@/lib/legacy-lookups";

export async function GET(request: NextRequest) {
  try {
    await requireAuth("admin");

    const params = request.nextUrl.searchParams;
    const status = params.get("status");
    const search = params.get("search");
    const page = Number(params.get("page") || "1");
    const limit = Number(params.get("limit") || "20");

    // Student name/email and razorpayPaymentId all need to be searched together,
    // but `student` lives in legacy (vw_students), not in tq_orders. So when
    // `search` is provided we resolve matching student IDs first (in legacy),
    // then OR them with razorpayPaymentId at the SQL layer for accurate paging.
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (search) {
      const term = `%${search}%`;
      const matched = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
        `SELECT id FROM vw_students WHERE name LIKE ? OR email LIKE ? LIMIT 500`,
        term, term,
      );
      const matchedIds = matched.map((r) => Number(r.id));
      where.OR = [
        { razorpayPaymentId: { contains: search } },
        ...(matchedIds.length ? [{ studentId: { in: matchedIds } }] : []),
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          bundle: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    const studentIds = Array.from(new Set(orders.map((o) => o.studentId)));
    const testIds = Array.from(new Set(orders.flatMap((o) => (o.itemType === "TEST" && o.testId ? [o.testId] : []))));
    const [studentMap, testMap] = await Promise.all([
      findStudentsByIds(studentIds),
      findTestsByIds(testIds),
    ]);

    const ordersOut = orders.map((o) => ({
      ...o,
      student: studentMap.get(o.studentId) ?? null,
      test: o.testId ? (testMap.get(o.testId) ? { id: o.testId, name: testMap.get(o.testId)!.name } : null) : null,
    }));

    return success({ orders: ordersOut, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    return handleApiError(err);
  }
}
