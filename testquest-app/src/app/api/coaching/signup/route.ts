/**
 * POST /api/coaching/signup — self-serve centre owner signup.
 *
 * In one transaction:
 *  1. Creates a row in legacy `student` (the owner's user account).
 *  2. Creates a tq_organizations row (type=COACHING_CENTRE).
 *  3. Creates a tq_org_memberships row (role=OWNER).
 *  4. Creates a tq_subscriptions row (status=TRIAL, plan=Starter, 14 days).
 *
 * Then issues a JWT with orgId + orgRole=OWNER so the frontend can land the
 * user straight on /coaching/dashboard (or /coaching/setup once it ships).
 *
 * Implementation note: the legacy `student` write goes through raw SQL via
 * `createLegacyStudent`. We can't put it inside a Prisma `$transaction` block
 * because that helper opens its own connection. Instead we do the legacy
 * insert first, then a Prisma transaction for the tq_* rows. If the tq_*
 * transaction fails, the orphaned student row stays (matches the same risk
 * the consumer signup has). Acceptable for MVP — flagged for hardening later.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, signToken } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { createLegacyStudent, findByEmail } from "@/lib/legacy-students";
import { seedSampleData } from "@/lib/services/sample-data.service";
import {
  OrgType,
  OrgRole,
  SubscriptionStatus,
} from "@/generated/prisma/client";

const signupSchema = z.object({
  centreName:        z.string().min(2).max(300),
  ownerName:         z.string().min(2).max(200),
  city:              z.string().min(1).max(100),
  mobile:            z.string().min(10).max(20),
  email:             z.string().email().max(200),
  password:          z.string().min(6).max(100),
  expectedStudents:  z.number().int().positive().max(10_000),
  // Task 5.4 — default-on so every new owner gets a clickable demo. One button
  // on the dashboard deletes it; easier to remove than to not have.
  includeSampleData: z.boolean().optional().default(true),
});

function roundSeatsUp(n: number): number {
  // Round to nearest 10 to give the owner a slightly looser seat cap during trial.
  return Math.max(10, Math.ceil(n / 10) * 10);
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, signupSchema);

    // Email uniqueness check (against legacy `student`)
    const existing = await findByEmail(body.email);
    if (existing) return error("Email already registered", 409);

    // 1. Owner's legacy student row
    const passwordHash = await hashPassword(body.password);
    const ownerId = await createLegacyStudent({
      name: body.ownerName,
      email: body.email,
      mobile: body.mobile,
      passwordHash,
      classId: null,        // owner doesn't take tests as a student themselves
      board: null,
    });

    // 2-4. Org + membership + trial subscription, atomically.
    const starter = await prisma.subscriptionPlan.findFirst({
      where: { name: "Starter", targetAudience: "COACHING_CENTRE", isActive: true },
    });
    if (!starter) return error("Starter plan not configured — contact support.", 500);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);
    const seats = roundSeatsUp(body.expectedStudents);

    const org = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          name: body.centreName,
          type: OrgType.COACHING_CENTRE,
          city: body.city,
          ownerUserId: ownerId,
        },
      });
      await tx.orgMembership.create({
        data: { orgId: created.id, userId: ownerId, role: OrgRole.OWNER },
      });
      await tx.subscription.create({
        data: {
          orgId: created.id,
          planId: starter.id,
          seatsPurchased: seats,
          expiresAt,
          status: SubscriptionStatus.TRIAL,
        },
      });
      return created;
    });

    // Task 5.4 — fire-and-forget sample-data seed. We deliberately don't await:
    // the new owner shouldn't wait on 10 INSERTs + an assignment before the
    // signup response lands. Failure here is logged but not user-visible — they
    // can still use the empty dashboard.
    if (body.includeSampleData) {
      void seedSampleData({ orgId: org.id, createdBy: ownerId }).catch((e) => {
        console.error("[signup] sample-data seed failed", { orgId: org.id, err: e });
      });
    }

    // Issue JWT with org context so the user lands authed on /coaching/dashboard.
    const token = signToken({
      id: ownerId,
      email: body.email.toLowerCase(),
      role: "student",
      orgId: org.id,
      orgRole: OrgRole.OWNER,
    });

    const response = success(
      {
        ownerId,
        orgId: org.id,
        orgName: org.name,
        plan: "Starter",
        seats,
        trialEndsAt: expiresAt,
      },
      201,
    );
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    return response;
  } catch (err) {
    return handleApiError(err);
  }
}

// Disallow other verbs explicitly to avoid Next.js's default 405 fallback being
// ambiguous in callers.
export function GET() {
  return NextResponse.json({ ok: false, error: "Method not allowed" }, { status: 405 });
}
