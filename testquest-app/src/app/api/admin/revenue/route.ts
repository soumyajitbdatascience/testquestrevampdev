import { NextRequest } from "next/server";
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
      topBundles,
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

      // Top selling bundles
      prisma.bundle.findMany({
        where: { orders: { some: { status: "PAID" } } },
        select: {
          id: true,
          name: true,
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

      // Total students — legacy `student` table is the source of truth (shared w/ mobile).
      // The tq_students table is unused.
      prisma.$queryRaw<Array<{ cnt: bigint }>>`
        SELECT COUNT(*) AS cnt FROM vw_students WHERE isActive = 1
      `,
    ]);

    return success({
      allTime: {
        revenue: Number(totalRevenue._sum.finalAmount || 0),
        orders: totalRevenue._count,
      },
      period: {
        days,
        revenue: Number(periodRevenue._sum.finalAmount || 0),
        orders: periodRevenue._count,
      },
      ordersByStatus: orderCount.map((o) => ({
        status: o.status,
        count: o._count,
      })),
      dailyRevenue: dailyRevenue.map((d) => ({
        date: d.date,
        revenue: Number(d.revenue),
        orders: Number(d.orders),
      })),
      topBundles: topBundles.map((b) => ({
        id: b.id,
        name: b.name,
        price: Number(b.price),
        orderCount: b._count.orders,
      })),
      couponStats: couponStats.map((c) => ({
        code: c.code,
        discountType: c.discountType,
        discountValue: Number(c.discountValue),
        timesUsed: c._count.usages,
      })),
      totalStudents: Number(studentCount[0]?.cnt ?? 0),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
