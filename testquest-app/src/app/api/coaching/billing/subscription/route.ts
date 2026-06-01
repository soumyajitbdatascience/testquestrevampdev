/**
 * /api/coaching/billing/subscription  (Task 4.1)
 *
 *   GET    → current mandate + subscription state for the owner's org.
 *   DELETE → cancel the recurring mandate. By default cancels at cycle end so
 *            the org keeps the period they've paid for; pass ?immediate=1 to
 *            cancel now. Our local status flip happens via the
 *            `subscription.cancelled` webhook (single source of truth).
 */
import { requireOrgRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError, success, error } from "@/lib/api-utils";
import { resolveSubscriptionState } from "@/lib/services/subscription.service";
import {
  cancelMandate,
  RazorpaySubscriptionError,
} from "@/lib/services/razorpay-subscription.service";

export async function GET() {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN"]);
    const orgId = session.orgId!;

    const state = await resolveSubscriptionState(orgId);
    const sub = await prisma.subscription.findFirst({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      select: {
        billingCycle: true,
        autoRenew: true,
        razorpaySubscriptionId: true,
        razorpayMeta: true,
      },
    });

    const meta = (sub?.razorpayMeta ?? null) as { status?: string; short_url?: string } | null;

    return success({
      ...state,
      billingCycle: sub?.billingCycle ?? null,
      autoRenew: sub?.autoRenew ?? false,
      hasMandate: Boolean(sub?.razorpaySubscriptionId),
      mandateStatus: meta?.status ?? null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN"]);
    const orgId = session.orgId!;
    const immediate = new URL(req.url).searchParams.get("immediate") === "1";

    const result = await cancelMandate(orgId, { atCycleEnd: !immediate });
    return success({ ...result, immediate });
  } catch (err) {
    if (err instanceof RazorpaySubscriptionError) return error(err.message, err.status);
    return handleApiError(err);
  }
}
