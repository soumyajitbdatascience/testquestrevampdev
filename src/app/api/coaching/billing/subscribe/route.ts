/**
 * POST /api/coaching/billing/subscribe  (Task 4.1)
 *
 * Owner / Admin starts a RECURRING Razorpay mandate (auto-renew) for their
 * org's subscription. Distinct from the one-time /coaching/billing/checkout
 * flow — here Razorpay auto-charges each cycle and our webhook is the source
 * of truth for activation / renewal.
 *
 * Body: { planId, cycle: "MONTHLY" | "QUARTERLY" | "ANNUAL" }
 * Returns the data the client needs to open Razorpay Checkout in subscription
 * mode: { razorpaySubscriptionId, shortUrl, razorpayKeyId }.
 */
import { z } from "zod";
import { requireOrgRole } from "@/lib/auth";
import { findById } from "@/lib/legacy-students";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import {
  createSubscriptionMandate,
  RazorpaySubscriptionError,
} from "@/lib/services/razorpay-subscription.service";
import { BillingCycle } from "@/generated/prisma/client";

const schema = z.object({
  planId: z.number().int().positive(),
  cycle: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL"]),
});

export async function POST(req: Request) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN"]);
    const body = await parseBody(req, schema);
    const orgId = session.orgId!;

    // Owner contact for the Razorpay customer record (best-effort).
    const owner = await findById(session.id);

    const result = await createSubscriptionMandate({
      orgId,
      planId: body.planId,
      cycle: body.cycle as BillingCycle,
      ownerEmail: owner?.email ?? session.email,
      ownerName: owner?.name ?? null,
      ownerMobile: owner?.mobile ?? null,
    });

    return success({
      razorpaySubscriptionId: result.razorpaySubscriptionId,
      shortUrl: result.shortUrl,
      razorpayKeyId: result.razorpayKeyId,
      subscriptionId: result.subscriptionId,
    });
  } catch (err) {
    if (err instanceof RazorpaySubscriptionError) return error(err.message, err.status);
    return handleApiError(err);
  }
}
