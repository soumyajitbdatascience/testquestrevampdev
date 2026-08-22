import { prisma } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { grantClassAccess } from "@/lib/passes";
import { sendReceipt } from "@/lib/email-lifecycle";
import { Prisma } from "@/generated/prisma/client";
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

    // Recurring-subscription events (subscription.*) are deliberately not
    // handled: the model is one-time prepaid passes with no auto-renewal, and
    // the mandate state machine lives in the B2B stack whose tables are not in
    // this database. Razorpay is acked so it stops retrying.

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

/**
 * One-time `payment.captured` → grant the pass. The **backstop** path: it runs
 * whether or not the browser ever came back from Razorpay.
 *
 * It does not mark the order paid itself. The status flip is the mutex that
 * lives inside `grantClassAccess`'s transaction — flipping it here first would
 * hand the grant an order that already looks settled, and a crash between the
 * two statements would leave a paid order with no access and no way for a
 * retry to notice.
 */
async function handlePaymentCaptured(event: {
  payload: { payment: { entity: { id: string; order_id: string } } };
}) {
  const payment = event.payload.payment.entity;

  const order = await prisma.order.findFirst({
    where: { razorpayOrderId: payment.order_id },
    select: { id: true },
  });
  if (!order) return;

  // Idempotent, and safe to lose the race against orders/verify: coupon usage
  // and the context upsert happen inside the same transaction as the grant.
  await grantClassAccess(order.id, { razorpayPaymentId: payment.id });

  // The browser may never have come back, so the backstop sends the receipt
  // too; the ledger key means only one of the two actually goes out.
  try {
    await sendReceipt(order.id);
  } catch (e) {
    console.error("Receipt send failed:", e);
  }
}
