import Razorpay from "razorpay";
import crypto from "crypto";

let instance: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (!instance) {
    instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }
  return instance;
}

export function verifyWebhookSignature(
  body: string,
  signature: string
): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return safeEqualHex(expected, signature);
}

export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const generated = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return safeEqualHex(generated, signature);
}

/**
 * Verify the client-side handler signature returned after a subscription
 * mandate is authorized. Razorpay computes this HMAC over
 * `payment_id|subscription_id` (note the order is the REVERSE of the one-time
 * `order_id|payment_id` form). Used by the subscribe-verify path; the webhook
 * remains the authoritative source for recurring charges.
 */
export function verifySubscriptionSignature(
  subscriptionId: string,
  paymentId: string,
  signature: string
): boolean {
  const generated = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${paymentId}|${subscriptionId}`)
    .digest("hex");
  return safeEqualHex(generated, signature);
}

/** Constant-time hex compare that won't throw on length mismatch. */
function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
