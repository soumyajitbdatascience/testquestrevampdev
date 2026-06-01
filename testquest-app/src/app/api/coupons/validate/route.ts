import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { findTestById } from "@/lib/legacy-lookups";

const validateSchema = z.object({
  code: z.string().min(1),
  itemType: z.enum(["TEST", "BUNDLE"]),
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

    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validUntil) {
      return error("Coupon has expired", 400);
    }

    // Get item price
    let price = 0;
    if (body.itemType === "TEST") {
      const test = await findTestById(body.itemId);
      if (!test || !test.isActive) return error("Test not found", 404);
      if (test.isFree) return error("This test is free — no coupon needed", 400);
      price = test.price;
    } else {
      const bundle = await prisma.bundle.findUnique({ where: { id: body.itemId } });
      if (!bundle) return error("Bundle not found", 404);
      price = Number(bundle.price);
    }

    if (Number(coupon.minOrderValue) > price) {
      return error(`Minimum order value is ₹${coupon.minOrderValue}`, 400);
    }

    // Check scope
    if (coupon.scope === "BUNDLE_ONLY" && body.itemType !== "BUNDLE") {
      return error("This coupon is only valid for bundles", 400);
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
    if (coupon.totalUsageLimit) {
      const totalUsed = await prisma.couponUsage.count({ where: { couponId: coupon.id } });
      if (totalUsed >= coupon.totalUsageLimit) {
        return error("Coupon usage limit reached", 400);
      }
    }
    const userUsed = await prisma.couponUsage.count({
      where: { couponId: coupon.id, studentId: session.id },
    });
    if (userUsed >= coupon.perUserLimit) {
      return error("You have already used this coupon", 400);
    }

    // Calculate discount
    let discount = 0;
    if (coupon.discountType === "PERCENTAGE") {
      discount = (price * Number(coupon.discountValue)) / 100;
      if (coupon.maxDiscountCap) {
        discount = Math.min(discount, Number(coupon.maxDiscountCap));
      }
    } else {
      discount = Number(coupon.discountValue);
    }
    discount = Math.min(discount, price);

    return success({
      valid: true,
      code: coupon.code,
      discountType: coupon.discountType,
      discount: Number(discount.toFixed(2)),
      originalPrice: price,
      finalPrice: Number((price - discount).toFixed(2)),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
