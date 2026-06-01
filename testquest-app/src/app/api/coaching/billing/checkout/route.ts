/**
 * POST /api/coaching/billing/checkout
 *
 * Owner / Admin starts a Razorpay one-time payment to convert / renew their
 * org's subscription. We mirror the consumer /api/orders/create flow but
 * stamp itemType=ORG_SUB and bundleId=<subscriptionId>.
 *
 * Returns the same Razorpay order shape the consumer flow returns so the
 * existing client-side Razorpay handler can be reused. The corresponding
 * verify endpoint is /api/coaching/billing/verify.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgRole } from "@/lib/auth";
import { getRazorpay } from "@/lib/razorpay";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { quoteUpgrade, resolveSubscriptionState } from "@/lib/services/subscription.service";

const schema = z.object({
  planId: z.number().int().positive(),
});

export async function POST(req: Request) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN"]);
    const body = await parseBody(req, schema);
    const orgId = session.orgId!;

    const state = await resolveSubscriptionState(orgId);
    if (!state.subscriptionId) return error("No subscription on file", 400);

    const quote = await quoteUpgrade(orgId, body.planId);
    if (!quote) return error("Plan not found", 404);
    if (quote.amount <= 0) return error("Selected plan has no billable amount", 400);

    const razorpay = getRazorpay();
    const rzpOrder = await razorpay.orders.create({
      amount: Math.round(quote.amount * 100),
      currency: "INR",
      receipt: `org_sub_${orgId}_${Date.now()}`,
      notes: {
        orgId: String(orgId),
        subscriptionId: String(state.subscriptionId),
        planId: String(body.planId),
        seats: String(quote.seats),
      },
    });

    const order = await prisma.order.create({
      data: {
        studentId: session.id,       // soft ref — order is attributed to the owner who paid
        itemType: "ORG_SUB",
        bundleId: state.subscriptionId, // re-used as subscription id (FK is soft).
        amount: quote.amount,
        discount: 0,
        finalAmount: quote.amount,
        razorpayOrderId: rzpOrder.id,
        status: "PENDING",
      },
    });

    return success({
      orderId: order.id,
      razorpayOrderId: rzpOrder.id,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      amount: quote.amount,
      amountInPaise: Math.round(quote.amount * 100),
      currency: "INR",
      planName: quote.planName,
      months: quote.months,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
