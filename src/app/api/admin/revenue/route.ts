import { NextRequest } from "next/server";
import { paiseToRupees } from "@/lib/money";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, success } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    await requireAuth("admin");

    const days = Number(request.nextUrl.searchParams.get("days") || "30");
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [
      totalRevenue,
      periodRevenue,
      orderCount,
      dailyRevenue,
      topPlans,
      couponStats,
      studentCount,
    ] = await Promise.all([
      // All-time revenue
      prisma.order.aggregate({
        where: { status: "PAID" },
        _sum: { finalAmount: true },
        _count: true,
      }),

      // Period revenue
      prisma.order.aggregate({
        where: { status: "PAID", createdAt: { gte: since } },
        _sum: { finalAmount: true },
        _count: true,
      }),

      // Total orders by status
      prisma.order.groupBy({
        by: ["status"],
        _count: true,
      }),

      // Daily revenue for chart
      prisma.$queryRaw<Array<{ date: string; revenue: number; orders: bigint }>>`
        SELECT
          DATE(createdAt) as date,
          SUM(finalAmount) as revenue,
          COUNT(*) as orders
        FROM tq_orders
        WHERE status = 'PAID' AND createdAt >= ${since}
        GROUP BY DATE(createdAt)
        ORDER BY date ASC
      `,

      // Top selling plans (bundles are retired in the decoupled model — the
      // only sellable item is a Board+Class pass).
      prisma.b2cPlan.findMany({
        where: { orders: { some: { status: "PAID" } } },
        select: {
          id: true,
          boardId: true,
          classId: true,
          durationMonths: true,
          price: true,
          _count: { select: { orders: { where: { status: "PAID" } } } },
        },
        orderBy: { orders: { _count: "desc" } },
        take: 10,
      }),

      // Coupon usage stats
      prisma.coupon.findMany({
        where: { usages: { some: {} } },
        select: {
          id: true,
          code: true,
          discountType: true,
          discountValue: true,
          _count: { select: { usages: true } },
        },
        orderBy: { usages: { _count: "desc" } },
        take: 10,
      }),

      // Total students — tq_students is the source of truth on the new DB
      // (it starts empty; signups fill it).
      prisma.student.count({ where: { isActive: true } }),
    ]);

    // Plan labels for the "top selling" list
    const [boardMap, classMap] = await Promise.all([
      prisma.board.findMany({ select: { id: true, code: true } }).then((r) => new Map(r.map((b) => [b.id, b.code]))),
      prisma.class.findMany({ select: { id: true, name: true } }).then((r) => new Map(r.map((c) => [c.id, c.name]))),
    ]);

    return success({
      allTime: {
        revenue: paiseToRupees(Number(totalRevenue._sum.finalAmount || 0)),
        orders: totalRevenue._count,
      },
      period: {
        days,
        revenue: paiseToRupees(Number(periodRevenue._sum.finalAmount || 0)),
        orders: periodRevenue._count,
      },
      ordersByStatus: orderCount.map((o) => ({
        status: o.status,
        count: o._count,
      })),
      dailyRevenue: dailyRevenue.map((d) => ({
        date: d.date,
        revenue: paiseToRupees(Number(d.revenue)),
        orders: Number(d.orders),
      })),
      topPlans: topPlans.map((p) => ({
        id: p.id,
        name: `${boardMap.get(p.boardId) ?? "—"} ${classMap.get(p.classId) ?? `Class ${p.classId}`} · ${p.durationMonths}mo`,
        price: Number(p.price),
        orderCount: p._count.orders,
      })),
      couponStats: couponStats.map((c) => ({
        code: c.code,
        discountType: c.discountType,
        discountValue: Number(c.discountValue),
        timesUsed: c._count.usages,
      })),
      totalStudents: studentCount,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
