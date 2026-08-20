/**
 * Idempotent sending — every lifecycle email goes through `sendOnce`.
 *
 * Two guarantees, in this order:
 *
 *  1. **Unsubscribe.** Non-transactional mail is dropped for a student who has
 *     opted out. The gate lives here rather than in each template, so it
 *     cannot be forgotten by the next one added. Verification, password reset
 *     and receipts are transactional and always send — they are records of
 *     something the student did, not marketing.
 *
 *  2. **Exactly once.** The ledger row is claimed *before* the provider call.
 *     `tq_email_sends` has UNIQUE(kind, studentId, refKey), so a second attempt
 *     at the same logical send loses on the constraint and is skipped — which
 *     is what makes a cron re-run, an overlapping schedule or a retried webhook
 *     safe. If the provider then fails, the claim is released so the send can
 *     be retried; a *successful* send is never repeated.
 *
 * The claim-then-send order matters. Sending first and recording after would
 * double-send whenever the process died in between — the exact failure a cron
 * that retries is guaranteed to hit eventually.
 */
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { Prisma } from "@/generated/prisma/client";

export type SendOutcome =
  | { sent: true; messageId?: string }
  | { sent: false; reason: "duplicate" | "unsubscribed" | "no_recipient" | "provider_error"; error?: string };

export interface SendOnceInput {
  /** Template identity — half of the dedupe key. */
  kind: string;
  studentId: number;
  /** What makes this send unique: "order:412", "access:88:T-7". */
  refKey: string;
  subject: string;
  text: string;
  html?: string;
  /**
   * Transactional mail ignores the unsubscribe preference and carries no
   * unsubscribe footer. Default false — opting in has to be deliberate.
   */
  transactional?: boolean;
}

export async function sendOnce(input: SendOnceInput): Promise<SendOutcome> {
  const student = await prisma.student.findUnique({
    where: { id: input.studentId },
    select: { email: true, marketingOptOut: true, isActive: true },
  });
  if (!student?.email || !student.isActive) return { sent: false, reason: "no_recipient" };

  if (!input.transactional && student.marketingOptOut) {
    return { sent: false, reason: "unsubscribed" };
  }

  // Claim first. A duplicate key here means somebody already sent this.
  try {
    await prisma.emailSend.create({
      data: { kind: input.kind, studentId: input.studentId, refKey: input.refKey },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { sent: false, reason: "duplicate" };
    }
    throw err;
  }

  const result = await sendEmail({
    to: student.email,
    subject: input.subject,
    text: input.text,
    html: input.html,
    ...(input.transactional ? {} : { listUnsubscribeUrl: unsubscribeUrl(input.studentId) }),
  });

  if (!result.delivered) {
    // Release the claim so a retry can try again — an undelivered email must
    // not be remembered as sent.
    await prisma.emailSend.deleteMany({
      where: { kind: input.kind, studentId: input.studentId, refKey: input.refKey },
    });
    return { sent: false, reason: "provider_error", error: result.error };
  }

  if (result.messageId) {
    await prisma.emailSend.updateMany({
      where: { kind: input.kind, studentId: input.studentId, refKey: input.refKey },
      data: { providerMessageId: result.messageId },
    });
  }
  return { sent: true, messageId: result.messageId };
}

/**
 * Unsubscribe links are signed, not stored.
 *
 * An HMAC of the student id means no token rows to create, expire or clean up,
 * and a link inside a year-old email still works — which matters, because the
 * alternative to a working unsubscribe link is a spam report.
 */
function unsubscribeSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required to sign unsubscribe links");
  return secret;
}

export function unsubscribeToken(studentId: number): string {
  return crypto.createHmac("sha256", unsubscribeSecret())
    .update(`unsubscribe:${studentId}`)
    .digest("hex");
}

export function verifyUnsubscribeToken(studentId: number, token: string): boolean {
  const expected = Buffer.from(unsubscribeToken(studentId));
  const given = Buffer.from(token ?? "");
  if (expected.length !== given.length) return false;
  return crypto.timingSafeEqual(expected, given);
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function unsubscribeUrl(studentId: number): string {
  return `${appUrl()}/unsubscribe?s=${studentId}&t=${unsubscribeToken(studentId)}`;
}
