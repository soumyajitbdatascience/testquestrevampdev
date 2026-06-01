import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getRazorpay } from "@/lib/razorpay";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { findTestById } from "@/lib/legacy-lookups";

const createOrderSchema = z.object({
  itemType: z.enum(["TEST", "BUNDLE"]),
  itemId: z.number().int().positive(),
  couponCode: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireAuth("student");
    const body = await parseBody(request, createOrderSchema);

    let amount: number;
    let testId: number | null = null;
    let bundleId: number | null = null;

    if (body.itemType === "TEST") {
      const test = await findTestById(body.itemId);
      if (!test || !test.isActive) return error("Test not found", 404);
      if (test.isFree) return error("This test is free — no purchase needed", 400);

      // Check if already purchased
      const existing = await prisma.studentAccess.findUnique({
        where: {
          studentId_testId: { studentId: session.id, testId: test.id },
        },
      });
      if (existing && (!existing.expiresAt || existing.expiresAt > new Date())) {
        return error("You already have access to this test", 409);
      }

      amount = test.price;
      testId = test.id;
    } else {
      const bundle = await prisma.bundle.findUnique({
        where: { id: body.itemId, isActive: true },
        include: { tests: { select: { testId: true } } },
      });
      if (!bundle) return error("Bundle not found", 404);
      amount = Number(bundle.price);
      bundleId = bundle.id;
    }

    // Apply coupon if provided
    let discount = 0;
    let couponCode: string | null = null;

    if (body.couponCode) {
      const coupon = await prisma.coupon.findUnique({
        where: { code: body.couponCode, isActive: true },
      });

      if (!coupon) return error("Invalid coupon code", 400);

      const now = new Date();
      if (now < coupon.validFrom || now > coupon.validUntil) {
        return error("Coupon has expired", 400);
      }

      if (Number(coupon.minOrderValue) > amount) {
        return error(`Minimum order value for this coupon is ₹${coupon.minOrderValue}`, 400);
      }

      // Check usage limits
      if (coupon.totalUsageLimit) {
        const totalUsed = await prisma.couponUsage.count({
          where: { couponId: coupon.id },
        });
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

      // Check scope
      if (coupon.scope === "BUNDLE_ONLY" && body.itemType !== "BUNDLE") {
        return error("This coupon is only valid for bundles", 400);
      }
      if (coupon.scope === "BUNDLE_ONLY" && coupon.bundleId && coupon.bundleId !== body.itemId) {
        return error("This coupon is not valid for this bundle", 400);
      }
      if (coupon.scope === "FIRST_TIME") {
        const prevOrders = await prisma.order.count({
          where: { studentId: session.id, status: "PAID" },
        });
        if (prevOrders > 0) {
          return error("This coupon is for first-time buyers only", 400);
        }
      }

      // Calculate discount
      if (coupon.discountType === "PERCENTAGE") {
        discount = (amount * Number(coupon.discountValue)) / 100;
        if (coupon.maxDiscountCap) {
          discount = Math.min(discount, Number(coupon.maxDiscountCap));
        }
      } else {
        discount = Number(coupon.discountValue);
      }

      discount = Math.min(discount, amount);
      couponCode = coupon.code;
    }

    const finalAmount = Math.max(0, amount - discount);

    // If free after coupon, grant access directly
    if (finalAmount === 0) {
      const order = await prisma.order.create({
        data: {
          studentId: session.id,
          itemType: body.itemType,
          testId,
          bundleId,
          amount,
          discount,
          finalAmount: 0,
          couponCode,
          status: "PAID",
        },
      });

      await grantAccess(session.id, body.itemType, body.itemId, order.id);

      if (couponCode) {
        const coupon = await prisma.coupon.findUnique({ where: { code: couponCode } });
        if (coupon) {
          await prisma.couponUsage.create({
            data: { couponId: coupon.id, studentId: session.id, orderId: order.id },
          });
        }
      }

      return success({ orderId: order.id, free: true, message: "Access granted!" });
    }

    // Create Razorpay order
    const razorpay = getRazorpay();
    const rzpOrder = await razorpay.orders.create({
      amount: Math.round(finalAmount * 100), // Razorpay expects paise
      currency: "INR",
      receipt: `order_${Date.now()}`,
      notes: {
        studentId: String(session.id),
        itemType: body.itemType,
        itemId: String(body.itemId),
      },
    });

    const order = await prisma.order.create({
      data: {
        studentId: session.id,
        itemType: body.itemType,
        testId,
        bundleId,
        amount,
        discount,
        finalAmount,
        couponCode,
        razorpayOrderId: rzpOrder.id,
        status: "PENDING",
      },
    });

    return success({
      orderId: order.id,
      razorpayOrderId: rzpOrder.id,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      amount: finalAmount,
      amountInPaise: Math.round(finalAmount * 100),
      currency: "INR",
    });
  } catch (err) {
    return handleApiError(err);
  }
}

async function grantAccess(
  studentId: number,
  itemType: string,
  itemId: number,
  orderId: number
) {
  if (itemType === "TEST") {
    await prisma.studentAccess.upsert({
      where: { studentId_testId: { studentId, testId: itemId } },
      create: { studentId, testId: itemId, orderId, expiresAt: null },
      update: { orderId, expiresAt: null },
    });
  } else {
    const bundle = await prisma.bundle.findUnique({
      where: { id: itemId },
      include: { tests: { select: { testId: true } } },
    });
    if (!bundle) return;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + bundle.validityDays);

    for (const bt of bundle.tests) {
      await prisma.studentAccess.upsert({
        where: { studentId_testId: { studentId, testId: bt.testId } },
        create: { studentId, testId: bt.testId, orderId, expiresAt },
        update: { orderId, expiresAt },
      });
    }
  }
}
