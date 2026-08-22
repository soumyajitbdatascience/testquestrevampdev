import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { findStudentsByIds } from "@/lib/commerce-lookups";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  code: z.string().min(1).max(50).transform((s) => s.toUpperCase()).optional(),
  discountType: z.enum(["PERCENT", "FLAT"]).optional(),
  discountValue: z.number().positive().optional(),
  maxDiscount: z.number().positive().nullable().optional(),
  minOrder: z.number().min(0).optional(),
  scope: z.enum(["ALL", "FIRST_TIME"]).optional(),
  totalLimit: z.number().int().positive().nullable().optional(),
  perUserLimit: z.number().int().positive().optional(),
  validFrom: z.string().transform((s) => new Date(s)).optional(),
  validUntil: z.string().transform((s) => new Date(s)).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const coupon = await prisma.coupon.findUnique({
      where: { id: Number(id) },
      include: {
        usages: {
          include: {
            order: { select: { id: true, finalAmount: true, createdAt: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        _count: { select: { usages: true } },
      },
    });
    if (!coupon) return error("Coupon not found", 404);
    const studentMap = await findStudentsByIds(coupon.usages.map((u) => u.studentId));
    return success({
      ...coupon,
      usages: coupon.usages.map((u) => ({ ...u, student: studentMap.get(u.studentId) ?? null })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const body = await parseBody(request, updateSchema);
    const updated = await prisma.coupon.update({
      where: { id: Number(id) },
      data: body,
    });
    return success(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    await prisma.coupon.update({
      where: { id: Number(id) },
      data: { isActive: false },
    });
    return success({ deactivated: true });
  } catch (err) {
    return handleApiError(err);
  }
}
