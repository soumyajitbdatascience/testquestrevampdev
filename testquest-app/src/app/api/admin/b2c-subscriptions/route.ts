import { NextRequest } from "next/server";
import { paiseToRupees } from "@/lib/money";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, success } from "@/lib/api-utils";

/**
 * B2C subscriptions dashboard (design 2g): stat tiles + filterable passes
 * table (server-paginated) + CSV export (?format=csv).
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth("admin");
    const p = request.nextUrl.searchParams;
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 86400e3);

    // Tiles
    const [activeCount, expiring7, revenueMonth] = await Promise.all([
      prisma.classAccess.count({ where: { expiresAt: { gt: now } } }),
      prisma.classAccess.count({ where: { expiresAt: { gt: now, lte: in7 } } }),
      prisma.order.aggregate({
        _sum: { finalAmount: true },
        where: {
          itemType: "B2C_PLAN", status: "PAID",
          createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
        },
      }),
    ]);

    // Filters
    const boardId = Number(p.get("boardId")) || null;
    const classId = Number(p.get("classId")) || null;
    const status = p.get("status"); // active | expired | expiring
    const page = Math.max(1, Number(p.get("page") || "1"));
    const pageSize = 50;

    const where: Record<string, unknown> = {};
    if (boardId) where.boardId = boardId;
    if (classId) where.classId = classId;
    if (status === "active") where.expiresAt = { gt: now };
    if (status === "expired") where.expiresAt = { lte: now };
    if (status === "expiring") where.expiresAt = { gt: now, lte: in7 };

    const [total, passes] = await Promise.all([
      prisma.classAccess.count({ where }),
      prisma.classAccess.findMany({
        where, orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize, take: pageSize,
      }),
    ]);

    // Resolve names
    const boards = new Map((await prisma.board.findMany()).map((b) => [b.id, b]));
    const classes = new Map(
      (await prisma.class.findMany({ select: { id: true, name: true } })).map((c) => [c.id, c.name]),
    );
    const plans = new Map((await prisma.b2cPlan.findMany()).map((pl) => [pl.id, pl]));
    // planId / orderId are nullable on tq_class_access (a pass can be granted
    // without an order — e.g. a comp'd or migrated grant).
    const orderIds = passes.flatMap((x) => (x.orderId != null && x.orderId > 0 ? [x.orderId] : []));
    const orders = orderIds.length
      ? new Map((await prisma.order.findMany({ where: { id: { in: orderIds } } })).map((o) => [o.id, o]))
      : new Map();
    const studentIds = [...new Set(passes.map((x) => x.studentId))];
    const students = new Map<number, { name: string; email: string }>();
    if (studentIds.length > 0) {
      const rows = await prisma.student.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, name: true, email: true },
      });
      for (const r of rows) students.set(r.id, { name: r.name, email: r.email });
    }

    const rows = passes.map((x) => ({
      id: x.id,
      student: students.get(x.studentId) ?? { name: `Student ${x.studentId}`, email: "" },
      boardCode: boards.get(x.boardId)?.code ?? "—",
      className: classes.get(x.classId) ?? `Class ${x.classId}`,
      durationMonths: x.planId != null ? plans.get(x.planId)?.durationMonths ?? null : null,
      purchasedAt: x.createdAt,
      expiresAt: x.expiresAt,
      daysLeft: Math.max(0, Math.ceil((x.expiresAt.getTime() - now.getTime()) / 86400e3)),
      // paise → rupees: this column is exported to CSV and read by a human.
      amount: x.orderId != null && orders.get(x.orderId) ? paiseToRupees(Number(orders.get(x.orderId)!.finalAmount)) : null,
      active: x.expiresAt > now,
    }));

    if (p.get("format") === "csv") {
      const header = "Student,Email,Board,Class,Duration,Purchased,Expires,Amount,Status";
      const csv = [header, ...rows.map((r) =>
        [r.student.name, r.student.email, r.boardCode, r.className,
         r.durationMonths ? `${r.durationMonths}mo` : "", r.purchasedAt.toISOString().slice(0, 10),
         r.expiresAt.toISOString().slice(0, 10), r.amount ?? "", r.active ? "Active" : "Expired",
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
      )].join("\n");
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": "attachment; filename=passes.csv",
        },
      });
    }

    return success({
      tiles: {
        activePasses: activeCount,
        revenueThisMonth: paiseToRupees(Number(revenueMonth._sum.finalAmount ?? 0)),
        expiring7Days: expiring7,
      },
      rows, total, page, pageSize,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
