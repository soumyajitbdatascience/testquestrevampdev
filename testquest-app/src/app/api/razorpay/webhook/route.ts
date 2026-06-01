import { prisma } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/razorpay";
import {
  activateSubscription,
  cycleToDays,
  markChargeFailed,
  setSubscriptionStatus,
} from "@/lib/services/subscription.service";
import { findSubByRazorpayId } from "@/lib/services/razorpay-subscription.service";
import { SubscriptionStatus, Prisma } from "@/generated/prisma/client";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-razorpay-signature") || "";

    if (!verifyWebhookSignature(body, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(body);

    // ── Idempotency guard ──────────────────────────────────────────────
    // Razorpay delivers at-least-once. Record each delivery's event id with a
    // UNIQUE constraint and short-circuit on replay. Header is the canonical
    // id; fall back to payload `id` if a delivery omits the header.
    const eventId =
      request.headers.get("x-razorpay-event-id") || event?.id || null;
    if (eventId) {
      try {
        await prisma.webhookEvent.create({
          data: { eventId, eventType: String(event?.event ?? "unknown") },
        });
      } catch (e) {
        // Unique violation → already processed. Ack so Razorpay stops retrying.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          return NextResponse.json({ ok: true, duplicate: true });
        }
        throw e;
      }
    }

    // ── One-time payment events (existing B2C + ORG_SUB checkout) ───────
    if (event.event === "payment.captured") {
      await handlePaymentCaptured(event);
    }

    if (event.event === "payment.failed") {
      const payment = event.payload.payment.entity;
      await prisma.order.updateMany({
        where: { razorpayOrderId: payment.order_id, status: "PENDING" },
        data: { status: "FAILED" },
      });
    }

    // ── Recurring subscription events (Task 4.1) ───────────────────────
    if (typeof event.event === "string" && event.event.startsWith("subscription.")) {
      await handleSubscriptionEvent(event);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

/** Recurring subscription lifecycle → our state machine. */
async function handleSubscriptionEvent(event: {
  event: string;
  payload?: {
    subscription?: { entity?: Record<string, unknown> };
    payment?: { entity?: { id?: string } };
  };
}) {
  const entity = event.payload?.subscription?.entity;
  const rzpSubId = entity?.id as string | undefined;
  if (!rzpSubId) return;

  const sub = await findSubByRazorpayId(rzpSubId);
  if (!sub) return; // unknown subscription — nothing to do

  // Keep the latest Razorpay snapshot for debugging / GET status.
  await prisma.subscription.update({
    where: { id: sub.id },
    data: { razorpayMeta: entity as unknown as Prisma.InputJsonValue },
  });

  switch (event.event) {
    case "subscription.authenticated":
      // Mandate approved by the customer; mark ACTIVE. The first charge event
      // (subscription.charged) will extend expiresAt.
      await setSubscriptionStatus(sub.id, SubscriptionStatus.ACTIVE);
      break;

    case "subscription.activated":
    case "subscription.charged": {
      // A cycle was charged successfully → extend coverage by the cycle length
      // and (re)activate. Idempotency is handled by the event-id guard above.
      const days = cycleToDays(sub.billingCycle);
      await activateSubscription({
        subscriptionId: sub.id,
        planId: sub.planId,
        extendByDays: days,
      });
      // Ledger row for the charge (audit). Dedupe by razorpayPaymentId.
      const paymentId = extractChargePaymentId(event);
      if (paymentId) {
        const exists = await prisma.order.findFirst({
          where: { razorpayPaymentId: paymentId },
          select: { id: true },
        });
        if (!exists) {
          const amount = extractChargeAmountInr(entity);
          await prisma.order.create({
            data: {
              studentId: sub.orgId ?? 0, // attributed to org; soft ref
              itemType: "ORG_SUB",
              // bundleId is reused as the subscription id (soft ref) for ORG_SUB
              // orders, so the originating recurring mandate is recoverable.
              bundleId: sub.id,
              amount,
              discount: 0,
              finalAmount: amount,
              razorpayPaymentId: paymentId,
              status: "PAID",
            },
          });
        }
      }
      break;
    }

    case "subscription.pending":
      // Auto-charge failed; enter GRACE (4.7 owns retries + dunning).
      await markChargeFailed(sub.id);
      break;

    case "subscription.halted":
      // Retries exhausted → lock out.
      await setSubscriptionStatus(sub.id, SubscriptionStatus.EXPIRED);
      break;

    case "subscription.cancelled":
      await setSubscriptionStatus(sub.id, SubscriptionStatus.CANCELLED);
      break;

    default:
      // subscription.completed / .updated / .paused — snapshot already saved.
      break;
  }
}

function extractChargePaymentId(event: {
  payload?: { payment?: { entity?: { id?: string } } };
}): string | null {
  return event.payload?.payment?.entity?.id ?? null;
}

function extractChargeAmountInr(entity: Record<string, unknown> | undefined): number {
  // Razorpay subscription entity may not carry the charge amount directly; the
  // paired payment entity does. Best-effort: 0 if unavailable (ledger amount is
  // informational — expiresAt extension is the functional effect).
  const paise = Number((entity as { current_amount?: number })?.current_amount ?? 0);
  return paise > 0 ? Math.round(paise / 100) : 0;
}

/** Existing one-time payment.captured handler (B2C tests/bundles + ORG_SUB). */
async function handlePaymentCaptured(event: {
  payload: { payment: { entity: { id: string; order_id: string } } };
}) {
  const payment = event.payload.payment.entity;
  const razorpayOrderId = payment.order_id;

  const order = await prisma.order.findFirst({
    where: { razorpayOrderId, status: "PENDING" },
  });
  if (!order) return;

  await prisma.order.update({
    where: { id: order.id },
    data: { status: "PAID", razorpayPaymentId: payment.id },
  });

  // ORG_SUB one-time conversion/renewal → activate the subscription.
  if (order.itemType === "ORG_SUB" && order.bundleId) {
    const sub = await prisma.subscription.findUnique({ where: { id: order.bundleId } });
    if (sub) {
      await activateSubscription({ subscriptionId: sub.id, planId: sub.planId });
    }
    return;
  }

  // Grant access (same logic as verify endpoint)
  if (order.itemType === "TEST" && order.testId) {
    await prisma.studentAccess.upsert({
      where: { studentId_testId: { studentId: order.studentId, testId: order.testId } },
      create: { studentId: order.studentId, testId: order.testId, orderId: order.id, expiresAt: null },
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
          where: { studentId_testId: { studentId: order.studentId, testId: bt.testId } },
          create: { studentId: order.studentId, testId: bt.testId, orderId: order.id, expiresAt },
          update: { orderId: order.id, expiresAt },
        });
      }
    }
  }

  if (order.couponCode) {
    const coupon = await prisma.coupon.findUnique({ where: { code: order.couponCode } });
    if (coupon) {
      const exists = await prisma.couponUsage.findFirst({
        where: { couponId: coupon.id, orderId: order.id },
      });
      if (!exists) {
        await prisma.couponUsage.create({
          data: { couponId: coupon.id, studentId: order.studentId, orderId: order.id },
        });
      }
    }
  }
}
