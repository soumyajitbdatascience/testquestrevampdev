import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { verifyPaymentSignature } from "@/lib/razorpay";
import { grantClassAccess } from "@/lib/passes";
import { sendReceipt } from "@/lib/email-lifecycle";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";

/**
 * Return-from-Razorpay verification — the instant-unlock path.
 *
 * The HMAC over `razorpay_order_id|razorpay_payment_id` is what proves the
 * payment happened; a browser saying "it worked" proves nothing. Only a valid
 * signature reaches the grant.
 *
 * This races the webhook on purpose, and `grantClassAccess` resolves the race:
 * exactly one of them writes the pass, and the other reports the same outcome.
 * Losing the race is a success — the student is unlocked either way.
 */
const verifySchema = z.object({
  orderId: z.number().int().positive(),
  razorpayPaymentId: z.string().min(1),
  razorpayOrderId: z.string().min(1),
  razorpaySignature: z.string().min(1),
}).strict();

export async function POST(request: Request) {
  try {
    const session = await requireAuth("student");
    const body = await parseBody(request, verifySchema);

    const order = await prisma.order.findUnique({
      where: { id: body.orderId },
      select: { id: true, studentId: true, status: true, razorpayOrderId: true },
    });
    if (!order || order.studentId !== session.id) return error("Order not found", 404);
    if (order.razorpayOrderId !== body.razorpayOrderId) return error("Order ID mismatch", 400);

    // The webhook may have already granted — that is a success for the student,
    // so report it rather than erroring on "already processed".
    if (order.status === "PAID") {
      const access = await prisma.classAccess.findFirst({
        where: { orderId: order.id }, orderBy: { expiresAt: "desc" }, select: { expiresAt: true },
      });
      return success({ verified: true, alreadyProcessed: true, expiresAt: access?.expiresAt ?? null });
    }
    if (order.status === "FAILED") return error("This payment did not go through", 400);

    if (!verifyPaymentSignature(body.razorpayOrderId, body.razorpayPaymentId, body.razorpaySignature)) {
      // Only a PENDING order may be failed here, so a late forged request can
      // never undo a legitimate grant the webhook already made.
      await prisma.order.updateMany({
        where: { id: order.id, status: "PENDING" },
        data: { status: "FAILED" },
      });
      return error("Payment verification failed", 400);
    }

    const granted = await grantClassAccess(order.id, {
      razorpayPaymentId: body.razorpayPaymentId,
      razorpaySignature: body.razorpaySignature,
    });
    if (!granted.granted) {
      return error(
        granted.reason === "coupon_exhausted"
          ? "That coupon has just been fully used — you have not been charged for a pass."
          : "Could not grant access. Support has the payment reference.",
        409,
      );
    }

    // Keyed on the order, so this and the webhook — which both legitimately
    // reach here — send exactly one receipt between them.
    try {
      await sendReceipt(order.id);
    } catch (e) {
      console.error("Receipt send failed:", e);
    }

    return success({
      verified: true,
      expiresAt: granted.expiresAt,
      message: "Payment successful! Access granted.",
    });
  } catch (err) {
    return handleApiError(err);
  }
}
