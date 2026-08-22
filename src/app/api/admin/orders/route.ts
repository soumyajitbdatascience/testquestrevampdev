import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, success } from "@/lib/api-utils";
import { findStudentsByIds } from "@/lib/commerce-lookups";
import { paiseToRupees } from "@/lib/money";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  try {
    await requireAuth("admin");

    const params = request.nextUrl.searchParams;
    const status = params.get("status");
    const search = params.get("search");
    const page = Number(params.get("page") || "1");
    const limit = Number(params.get("limit") || "20");

    // Search spans the payment id, the coupon code and the buyer's name/email.
    // The student is a real relation on tq_orders now, so this is one query
    // rather than the old two-step through the legacy student view.
    const where: Prisma.OrderWhereInput = {};
    if (status) where.status = status as Prisma.EnumOrderStatusFilter["equals"];
    if (search) {
      where.OR = [
        { razorpayPaymentId: { contains: search } },
        { couponCode: { contains: search } },
        { student: { name: { contains: search } } },
        { student: { email: { contains: search } } },
      ];
    }

    const [orders, total] = await Promise.all([
      // Orders only reference a class pass now — no bundle or test to join.
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    const studentIds = Array.from(new Set(orders.map((o) => o.studentId)));
    const studentMap = await findStudentsByIds(studentIds);

    // MONEY: orders store paise; these leave in rupees so the admin list and
    // the dashboard's recent-orders strip — the only two consumers, both
    // display-only — can print `₹{value}` directly. `/api/admin/revenue`
    // already divides its own aggregates, so nothing double-divides.
    const ordersOut = orders.map((o) => ({
      ...o,
      amount: paiseToRupees(Number(o.amount)),
      discount: paiseToRupees(Number(o.discount)),
      finalAmount: paiseToRupees(Number(o.finalAmount)),
      student: studentMap.get(o.studentId) ?? null,
      test: null,
    }));

    return success({ orders: ordersOut, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    return handleApiError(err);
  }
}
