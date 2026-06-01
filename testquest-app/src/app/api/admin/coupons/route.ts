import { z } from "zod";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success } from "@/lib/api-utils";

const createSchema = z.object({
  code: z.string().min(1).max(50).transform((s) => s.toUpperCase()),
  discountType: z.enum(["PERCENTAGE", "FLAT"]),
  discountValue: z.number().positive(),
  maxDiscountCap: z.number().positive().optional(),
  minOrderValue: z.number().min(0).default(0),
  scope: z.enum(["ALL", "BUNDLE_ONLY", "FIRST_TIME"]).default("ALL"),
  bundleId: z.number().int().positive().optional(),
  totalUsageLimit: z.number().int().positive().optional(),
  perUserLimit: z.number().int().positive().default(1),
  validFrom: z.string().transform((s) => new Date(s)),
  validUntil: z.string().transform((s) => new Date(s)),
});

export async function GET(request: NextRequest) {
  try {
    await requireAuth("admin");

    const page = Number(request.nextUrl.searchParams.get("page") || "1");
    const limit = Number(request.nextUrl.searchParams.get("limit") || "20");

    const [coupons, total] = await Promise.all([
      prisma.coupon.findMany({
        include: { _count: { select: { usages: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.coupon.count(),
    ]);

    return success({ coupons, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth("admin");
    const body = await parseBody(request, createSchema);

    const coupon = await prisma.coupon.create({ data: body });
    return success(coupon, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
