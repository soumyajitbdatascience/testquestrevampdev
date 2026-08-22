import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";

/**
 * Coupon validation. The decoupled model sells exactly one thing — a prepaid
 * Board+Class pass (tq_b2c_plans) — so per-test and bundle purchases are gone,
 * and with them the BUNDLE_ONLY scope.
 */
const validateSchema = z.object({
  code: z.string().min(1),
  itemType: z.literal("B2C_PLAN").default("B2C_PLAN"),
  // itemId is the tq_b2c_plans id
  itemId: z.number().int().positive(),
});

export async function POST(request: Request) {
  try {
    const session = await requireAuth("student");
    const body = await parseBody(request, validateSchema);

    const coupon = await prisma.coupon.findUnique({
      where: { code: body.code.toUpperCase(), isActive: true },
    });

    if (!coupon) return error("Invalid coupon code", 400);

    // validFrom / validUntil are nullable — an unset bound means "no bound".
    const now = new Date();
    if ((coupon.validFrom && now < coupon.validFrom) || (coupon.validUntil && now > coupon.validUntil)) {
      return error("Coupon has expired", 400);
    }

    const plan = await prisma.b2cPlan.findFirst({ where: { id: body.itemId, isActive: true } });
    if (!plan) return error("Plan not found", 404);
    const price = Number(plan.price);

    if (Number(coupon.minOrder) > price) {
      return error(`Minimum order value is ₹${coupon.minOrder}`, 400);
    }

    if (coupon.scope === "FIRST_TIME") {
      const prevOrders = await prisma.order.count({
        where: { studentId: session.id, status: "PAID" },
      });
      if (prevOrders > 0) {
        return error("This coupon is for first-time buyers only", 400);
      }
    }

    // Check limits
    if (coupon.totalLimit) {
      const totalUsed = await prisma.couponUsage.count({ where: { couponId: coupon.id } });
      if (totalUsed >= coupon.totalLimit) {
        return error("Coupon usage limit reached", 400);
      }
    }
    if (coupon.perUserLimit != null) {
      const userUsed = await prisma.couponUsage.count({
        where: { couponId: coupon.id, studentId: session.id },
      });
      if (userUsed >= coupon.perUserLimit) {
        return error("You have already used this coupon", 400);
      }
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discountType === "PERCENT") {
      discount = (price * Number(coupon.discountValue)) / 100;
      if (coupon.maxDiscount) {
        discount = Math.min(discount, Number(coupon.maxDiscount));
      }
    } else {
      discount = Number(coupon.discountValue);
    }
    discount = Math.min(discount, price);

    return success({
      valid: true,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      maxDiscount: coupon.maxDiscount != null ? Number(coupon.maxDiscount) : null,
      minOrder: Number(coupon.minOrder),
      discount: Number(discount.toFixed(2)),
      originalPrice: price,
      finalPrice: Number((price - discount).toFixed(2)),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
