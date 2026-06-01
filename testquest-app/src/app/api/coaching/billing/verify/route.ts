/**
 * POST /api/coaching/billing/verify
 *
 * Razorpay payment-verify for ORG_SUB orders. Mirrors /api/orders/verify but
 * the success side-effect is "activate the subscription" instead of grant
 * student access.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgRole } from "@/lib/auth";
import { verifyPaymentSignature } from "@/lib/razorpay";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { activateSubscription } from "@/lib/services/subscription.service";

const schema = z.object({
  orderId: z.number().int().positive(),
  razorpayPaymentId: z.string().min(1),
  razorpayOrderId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN"]);
    const body = await parseBody(req, schema);

    const order = await prisma.order.findUnique({ where: { id: body.orderId } });
    if (!order || order.studentId !== session.id) return error("Order not found", 404);
    if (order.itemType !== "ORG_SUB") return error("Wrong order type", 400);
    if (order.status !== "PENDING") return error("Order already processed", 400);
    if (order.razorpayOrderId !== body.razorpayOrderId) return error("Order ID mismatch", 400);

    const ok = verifyPaymentSignature(body.razorpayOrderId, body.razorpayPaymentId, body.razorpaySignature);
    if (!ok) {
      await prisma.order.update({ where: { id: order.id }, data: { status: "FAILED" } });
      return error("Payment verification failed", 400);
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        razorpayPaymentId: body.razorpayPaymentId,
        razorpaySignature: body.razorpaySignature,
      },
    });

    // Activate the subscription. We stored the subscriptionId in bundleId.
    if (order.bundleId) {
      // Recover the planId from Razorpay order notes via a fresh lookup —
      // but we don't have that handy here; default to the subscription's
      // current planId. (Webhook handler can do the same.)
      const sub = await prisma.subscription.findUnique({ where: { id: order.bundleId } });
      if (sub) {
        await activateSubscription({ subscriptionId: sub.id, planId: sub.planId });
      }
    }

    return success({ verified: true, message: "Subscription activated." });
  } catch (err) {
    return handleApiError(err);
  }
}
