/**
 * coaching-login service — Phase 2 / Task 2.7.
 *
 * Mobile + OTP sign-in flow for /coaching/login. Mirrors the existing join
 * OTP plumbing (invite.service.ts) but with a separate purpose namespace so
 * the two flows can't cross-consume codes.
 *
 *   issueLoginOtp(mobile)   → looks up the legacy student by mobile_no,
 *                             generates + stores a 6-digit OTP, sends SMS.
 *                             Throws if no student matches (UX favors
 *                             telling the user vs silently failing).
 *
 *   consumeLoginOtp(...)    → verifies the OTP, picks the best org role,
 *                             returns the studentId + redirect path. The
 *                             caller signs the JWT.
 *
 * Delivery channel: `sendNotification` (Phase 2 / Task 2.6) — picks
 * WhatsApp first, falls through to SMS. The recipient is identified solely
 * by mobile; email isn't an eligible channel for login OTPs.
 */
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { sendNotification } from "@/lib/notifications";
import { type OrgRole } from "@/generated/prisma/client";

const OTP_TTL_SECONDS = 5 * 60;
const OTP_MAX_ATTEMPTS = 5;
const OTP_PURPOSE_LOGIN = "login";

export class LoginOtpError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

function generateOtp(): string {
  // 6 digits, padded if Math.random gave us a small number.
  return Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
}

/** Strip non-digits + trim to last 10 (Indian mobile MVP). */
export function normaliseMobile(raw: string): string {
  const digits = raw.replace(/\D+/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

// ─── Helpers ───────────────────────────────────────────────────────

interface ResolvedAccount {
  studentId: number;
  email: string;
  name: string;
  /** Best active org membership — picks OWNER > ADMIN > TEACHER > STUDENT. */
  bestMembership: { orgId: number; orgRole: OrgRole; orgName: string } | null;
}

const ROLE_PRIORITY: Record<OrgRole, number> = {
  OWNER:  4,
  ADMIN:  3,
  TEACHER: 2,
  STUDENT: 1,
  PARENT:  0,
};

async function resolveAccountByMobile(normalised: string): Promise<ResolvedAccount | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{
    id: number; email: string | null; name: string;
  }>>(
    `SELECT student_id AS id, email_address AS email,
            TRIM(CONCAT(first_name, ' ', COALESCE(surname_name, ''))) AS name
     FROM student
     WHERE mobile_no = ?
       AND status = 1
     LIMIT 1`,
    normalised,
  );
  const r = rows[0];
  if (!r) return null;

  const memberships = await prisma.orgMembership.findMany({
    where: { userId: r.id, isActive: true },
    include: { org: { select: { id: true, name: true } } },
  });
  let best: ResolvedAccount["bestMembership"] = null;
  for (const m of memberships) {
    const prio = ROLE_PRIORITY[m.role];
    if (!best || prio > ROLE_PRIORITY[best.orgRole]) {
      best = { orgId: m.org.id, orgRole: m.role, orgName: m.org.name };
    }
  }

  return {
    studentId: r.id,
    email: r.email ?? "",
    name: r.name || "",
    bestMembership: best,
  };
}

// ─── Issue ─────────────────────────────────────────────────────────

export interface IssueLoginOtpResult {
  sent: true;
  /** Friendly label for the next step UI (e.g. "Sunrise Coaching Centre" or
   *  the masked email if no org). */
  audienceLabel: string | null;
  /** Dev-only echo of the OTP so testers don't need an SMS provider. */
  devOtp?: string;
}

export async function issueLoginOtp(mobile: string): Promise<IssueLoginOtpResult> {
  const normalised = normaliseMobile(mobile);
  if (normalised.length < 10) {
    throw new LoginOtpError("bad_mobile", "Enter a valid 10-digit mobile number.");
  }

  const account = await resolveAccountByMobile(normalised);
  if (!account) {
    throw new LoginOtpError(
      "no_account",
      "No Testquest account found for this mobile. Sign up first or ask your centre owner for an invite.",
      404,
    );
  }

  // Invalidate any prior open login OTP for this mobile.
  await prisma.otpCode.updateMany({
    where: { mobile: normalised, purpose: OTP_PURPOSE_LOGIN, usedAt: null },
    data:  { usedAt: new Date() },
  });

  const code = generateOtp();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);
  await prisma.otpCode.create({
    data: { mobile: normalised, codeHash, purpose: OTP_PURPOSE_LOGIN, expiresAt },
  });

  await sendNotification({
    template: "login-otp",
    params: {
      code,
      centreName: account.bestMembership?.orgName,
      ttlMinutes: Math.round(OTP_TTL_SECONDS / 60),
    },
    recipient: { mobile: normalised },
  });

  return {
    sent: true,
    audienceLabel: account.bestMembership?.orgName ?? null,
    devOtp: process.env.NODE_ENV !== "production" ? code : undefined,
  };
}

// ─── Consume ───────────────────────────────────────────────────────

export interface ConsumeLoginOtpInput {
  mobile: string;
  code: string;
}

export interface ConsumeLoginOtpResult {
  studentId: number;
  email: string;
  orgId: number | undefined;
  orgRole: OrgRole | undefined;
  redirect: string;
}

export async function consumeLoginOtp(input: ConsumeLoginOtpInput): Promise<ConsumeLoginOtpResult> {
  const normalised = normaliseMobile(input.mobile);
  if (normalised.length < 10) {
    throw new LoginOtpError("bad_mobile", "Enter a valid 10-digit mobile number.");
  }
  const cleanCode = input.code.replace(/\D+/g, "");
  if (cleanCode.length < 4) {
    throw new LoginOtpError("bad_code", "Enter the 6-digit code.");
  }

  const otpRow = await prisma.otpCode.findFirst({
    where: { mobile: normalised, purpose: OTP_PURPOSE_LOGIN, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!otpRow) throw new LoginOtpError("otp_required", "Please request a new code.", 410);
  if (otpRow.expiresAt < new Date()) throw new LoginOtpError("otp_expired", "Your code has expired. Request a new one.", 410);
  if (otpRow.attempts >= OTP_MAX_ATTEMPTS) {
    throw new LoginOtpError("otp_too_many_attempts", "Too many wrong attempts. Request a new code.", 429);
  }

  const valid = await bcrypt.compare(cleanCode, otpRow.codeHash);
  if (!valid) {
    await prisma.otpCode.update({ where: { id: otpRow.id }, data: { attempts: { increment: 1 } } });
    throw new LoginOtpError("otp_invalid", "That code didn't match. Try again.");
  }

  await prisma.otpCode.update({ where: { id: otpRow.id }, data: { usedAt: new Date() } });

  // Re-resolve the account (it may have changed between issue + consume, e.g.
  // their org was added in the last 30s).
  const account = await resolveAccountByMobile(normalised);
  if (!account) {
    // Defensive: the OTP was valid but the account is gone. Rare. Don't
    // signal which side failed.
    throw new LoginOtpError("account_gone", "We can't find your account. Contact support.", 410);
  }

  const orgId   = account.bestMembership?.orgId;
  const orgRole = account.bestMembership?.orgRole;
  const redirect = orgRole && (orgRole === "OWNER" || orgRole === "ADMIN" || orgRole === "TEACHER")
    ? "/coaching/dashboard"
    : "/dashboard";

  return {
    studentId: account.studentId,
    email:     account.email,
    orgId,
    orgRole,
    redirect,
  };
}
