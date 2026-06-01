import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { verifyPaymentSignature } from "@/lib/razorpay";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";

const verifySchema = z.object({
  orderId: z.number().int().positive(),
  razorpayPaymentId: z.string().min(1),
  razorpayOrderId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const session = await requireAuth("student");
    const body = await parseBody(request, verifySchema);

    const order = await prisma.order.findUnique({
      where: { id: body.orderId },
    });

    if (!order || order.studentId !== session.id) {
      return error("Order not found", 404);
    }
    if (order.status !== "PENDING") {
      return error("Order already processed", 400);
    }
    if (order.razorpayOrderId !== body.razorpayOrderId) {
      return error("Order ID mismatch", 400);
    }

    // Verify Razorpay signature
    const isValid = verifyPaymentSignature(
      body.razorpayOrderId,
      body.razorpayPaymentId,
      body.razorpaySignature
    );

    if (!isValid) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "FAILED" },
      });
      return error("Payment verification failed", 400);
    }

    // Mark order as paid
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        razorpayPaymentId: body.razorpayPaymentId,
        razorpaySignature: body.razorpaySignature,
      },
    });

    // Grant access
    if (order.itemType === "TEST" && order.testId) {
      await prisma.studentAccess.upsert({
        where: {
          studentId_testId: { studentId: session.id, testId: order.testId },
        },
        create: {
          studentId: session.id,
          testId: order.testId,
          orderId: order.id,
          expiresAt: null,
        },
        update: { orderId: order.id, expiresAt: null },
      });
    } else if (order.itemType === "BUNDLE" && order.bundleId) {
      const bundle = await prisma.bundle.findUnique({
        where: { id: order.bundleId },
        include: { tests: { select: { testId: true } } },
      });
      if (bundle) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + bundle.validityDays);

        for (const bt of bundle.tests) {
          await prisma.studentAccess.upsert({
            where: {
              studentId_testId: { studentId: session.id, testId: bt.testId },
            },
            create: {
              studentId: session.id,
              testId: bt.testId,
              orderId: order.id,
              expiresAt,
            },
            update: { orderId: order.id, expiresAt },
          });
        }
      }
    }

    // Record coupon usage
    if (order.couponCode) {
      const coupon = await prisma.coupon.findUnique({
        where: { code: order.couponCode },
      });
      if (coupon) {
        await prisma.couponUsage.create({
          data: {
            couponId: coupon.id,
            studentId: session.id,
            orderId: order.id,
          },
        });
      }
    }

    return success({ verified: true, message: "Payment successful! Access granted." });
  } catch (err) {
    return handleApiError(err);
  }
}
