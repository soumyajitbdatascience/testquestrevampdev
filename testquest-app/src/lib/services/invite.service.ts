/**
 * Invite service — student-side join flow for Task 1.5.
 *
 * Pipeline:
 *   resolveInviteToken(token)  → centre + batch context for the landing page
 *   issueJoinOtp(token, mobile)→ 6-digit OTP, hashed + stored in tq_otp_codes
 *   consumeJoinOtp(token, mobile, code, name)
 *     - verifies OTP (5-min window, 5-attempt cap, single-use)
 *     - mobile dedup against legacy `student`
 *     - seat-cap enforcement on the org's active Subscription
 *     - upserts BatchEnrollment + OrgMembership(STUDENT)
 *     - increments Subscription.seatsUsed when it's a *new* org member
 *     - returns the studentId + JWT-ready session payload
 *
 * Acceptance criteria from IMPLEMENTATION_PLAN Task 1.5:
 *   - Expired / unknown token → InviteError("invalid_token")
 *   - Mobile collision → reuse the existing legacy student row
 *   - Seat cap → InviteError("at_capacity") with friendly message
 *
 * Soft references: `student.student_id` is referenced as plain Int everywhere
 * (no Prisma relation on Order, Subscription, etc).
 */
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { OrgRole } from "@/generated/prisma/client";
import { createLegacyStudent } from "@/lib/legacy-students";
import { sendNotification } from "@/lib/notifications";

const OTP_TTL_SECONDS = 5 * 60;
const OTP_MAX_ATTEMPTS = 5;
const OTP_PURPOSE_JOIN = "join";

export class InviteError extends Error {
  code: "invalid_token" | "token_expired" | "at_capacity" | "otp_required" | "otp_invalid" | "otp_expired" | "otp_too_many_attempts";
  constructor(code: InviteError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export interface InviteContext {
  token: string;
  orgId: number;
  orgName: string;
  orgLogoUrl: string | null;
  batchId: number;
  batchName: string;
  expiresAt: Date;
}

/** Look up an invite token + centre/batch context. Throws if invalid or expired. */
export async function resolveInviteToken(token: string): Promise<InviteContext> {
  const row = await prisma.inviteToken.findUnique({
    where: { token },
    include: {
      org: { select: { id: true, name: true, logoUrl: true } },
      batch: { select: { id: true, name: true } },
    },
  });
  if (!row) throw new InviteError("invalid_token", "Invite link is invalid.");
  if (row.expiresAt < new Date()) {
    throw new InviteError("token_expired", "Invite link has expired. Ask your centre owner for a new one.");
  }
  return {
    token: row.token,
    orgId: row.org.id,
    orgName: row.org.name,
    orgLogoUrl: row.org.logoUrl,
    batchId: row.batch.id,
    batchName: row.batch.name,
    expiresAt: row.expiresAt,
  };
}

function generateOtp(): string {
  // 6-digit numeric code. `randomInt` gives a uniform distribution.
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Generate + hash + store an OTP for this (mobile, "join") purpose. Returns the
 * raw code so the caller can pass it to the SMS provider. Older un-used codes
 * for the same mobile/purpose are invalidated so a re-send overrides them.
 */
export async function issueJoinOtp(token: string, mobile: string): Promise<{ context: InviteContext; codeForDev: string }> {
  const context = await resolveInviteToken(token);
  const normalised = normaliseMobile(mobile);

  // Invalidate any prior open OTP for this mobile + purpose.
  await prisma.otpCode.updateMany({
    where: { mobile: normalised, purpose: OTP_PURPOSE_JOIN, usedAt: null },
    data: { usedAt: new Date() },
  });

  const code = generateOtp();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

  await prisma.otpCode.create({
    data: { mobile: normalised, codeHash, purpose: OTP_PURPOSE_JOIN, expiresAt },
  });

  await sendNotification({
    template: "join-otp",
    params: { code, centreName: context.orgName, ttlMinutes: Math.round(OTP_TTL_SECONDS / 60) },
    recipient: { mobile: normalised },
  });

  return { context, codeForDev: code };
}

export interface JoinResult {
  studentId: number;
  alreadyEnrolled: boolean;
  alreadyMember: boolean;
}

/**
 * Verify the OTP and complete the join. Atomic-ish: legacy student row + tq_*
 * writes are sequenced so a failure on tq_* leaves no half-state on the
 * commerce tables (BatchEnrollment + OrgMembership both use idempotent unique
 * keys).
 */
export async function consumeJoinOtp(input: {
  token: string;
  mobile: string;
  code: string;
  name: string;
}): Promise<{ context: InviteContext; result: JoinResult; studentEmail: string }> {
  const context = await resolveInviteToken(input.token);
  const normalised = normaliseMobile(input.mobile);

  // Find the most-recent live OTP for this mobile.
  const otpRow = await prisma.otpCode.findFirst({
    where: { mobile: normalised, purpose: OTP_PURPOSE_JOIN, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!otpRow) throw new InviteError("otp_required", "Please request a new code.");
  if (otpRow.expiresAt < new Date()) throw new InviteError("otp_expired", "Your code has expired. Request a new one.");
  if (otpRow.attempts >= OTP_MAX_ATTEMPTS) {
    throw new InviteError("otp_too_many_attempts", "Too many wrong attempts. Request a new code.");
  }

  const valid = await bcrypt.compare(input.code, otpRow.codeHash);
  if (!valid) {
    await prisma.otpCode.update({ where: { id: otpRow.id }, data: { attempts: { increment: 1 } } });
    throw new InviteError("otp_invalid", "That code didn't match. Try again.");
  }

  await prisma.otpCode.update({ where: { id: otpRow.id }, data: { usedAt: new Date() } });

  // Seat-cap check on the org's active subscription before we touch anything.
  const sub = await prisma.subscription.findFirst({
    where: { orgId: context.orgId, status: { in: ["TRIAL", "ACTIVE", "GRACE"] } },
    orderBy: { createdAt: "desc" },
  });
  // If they're not already an org member, this enrollment will consume one seat.
  const existingMembership = await prisma.orgMembership.findFirst({
    where: { orgId: context.orgId, userId: { not: 0 } },
    // we don't know studentId yet; the real check is after we resolve studentId
  });
  void existingMembership;

  // 1. Resolve legacy student by mobile, else create.
  const byMobile = await prisma.$queryRaw<Array<{ id: number; email: string }>>`
    SELECT student_id AS id, email_address AS email FROM student WHERE mobile_no = ${normalised} LIMIT 1
  `;
  let studentId: number;
  let studentEmail: string;
  if (byMobile[0]) {
    studentId = byMobile[0].id;
    studentEmail = byMobile[0].email;
  } else {
    // Synthetic email anchored on the verified mobile, so the legacy `student`
    // NOT-NULL email column stays satisfied without collisions.
    studentEmail = `join-${normalised}@testquest.local`;
    studentId = await createLegacyStudent({
      name: input.name.trim(),
      email: studentEmail,
      mobile: normalised,
      passwordHash: null,
      classId: null,
      board: null,
    });
  }

  // Now run the real seat-cap check (knowing studentId).
  const isAlreadyMember = await prisma.orgMembership.findFirst({
    where: { orgId: context.orgId, userId: studentId },
  });
  if (!isAlreadyMember && sub) {
    if (sub.seatsUsed >= sub.seatsPurchased) {
      throw new InviteError(
        "at_capacity",
        "This centre is at capacity. Contact the centre owner to add seats.",
      );
    }
  }

  // 2. Enrollment + membership + (optional) seat increment in one transaction.
  const result = await prisma.$transaction(async (tx) => {
    let alreadyEnrolled = false;
    try {
      await tx.batchEnrollment.create({ data: { batchId: context.batchId, studentId } });
    } catch (e) {
      // Unique violation on (batchId, studentId) → already enrolled.
      const code = (e as { code?: string }).code;
      if (code !== "P2002") throw e;
      alreadyEnrolled = true;
    }

    const memberExisting = await tx.orgMembership.findUnique({
      where: { orgId_userId_role: { orgId: context.orgId, userId: studentId, role: OrgRole.STUDENT } },
    }).catch(() => null);
    let alreadyMember = false;
    if (!memberExisting) {
      await tx.orgMembership.create({
        data: { orgId: context.orgId, userId: studentId, role: OrgRole.STUDENT },
      });
      // Bump seatsUsed only when this is a brand-new org membership.
      if (sub) {
        await tx.subscription.update({
          where: { id: sub.id },
          data: { seatsUsed: { increment: 1 } },
        });
      }
    } else {
      alreadyMember = true;
    }

    // Mark the invite-token used (idempotent — we update to latest each time).
    await tx.inviteToken.update({
      where: { token: context.token },
      data: { usedAt: new Date() },
    });

    return { studentId, alreadyEnrolled, alreadyMember };
  });

  return { context, result, studentEmail };
}

/** Strip non-digits and trim to last 10 (Indian mobile MVP). */
export function normaliseMobile(raw: string): string {
  const digits = raw.replace(/\D+/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}
