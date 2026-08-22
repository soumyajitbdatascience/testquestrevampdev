/**
 * POST /api/coaching/branches — Task 4.4.
 *
 * Creates a child organisation under the caller's current org and provisions
 * a 14-day TRIAL on the Starter coaching plan. The caller becomes OWNER of
 * the new branch. OWNER/ADMIN of the parent only.
 */
import { z } from "zod";
import { requireOrgRole } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { prisma } from "@/lib/db";
import { OrgRole, OrgType, SubscriptionStatus, type Prisma } from "@/generated/prisma/client";

const bodySchema = z.object({
  name: z.string().trim().min(2).max(300),
  city: z.string().trim().max(100).nullable().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN"]);
    const parentOrgId = session.orgId!;
    const body = await parseBody(req, bodySchema);

    const plan = await prisma.subscriptionPlan.findFirst({
      where: { name: "Starter", targetAudience: "COACHING_CENTRE", isActive: true },
    });
    if (!plan) return error("Starter plan is not available. Contact support.", 422);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    const branch = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          name: body.name,
          type: OrgType.COACHING_CENTRE,
          city: body.city ?? null,
          parentOrgId,
          ownerUserId: session.id,
        },
      });
      await tx.orgMembership.create({
        data: { orgId: created.id, userId: session.id, role: OrgRole.OWNER },
      });
      await tx.subscription.create({
        data: {
          orgId: created.id,
          planId: plan.id,
          seatsPurchased: 50,
          expiresAt,
          status: SubscriptionStatus.TRIAL,
        } satisfies Prisma.SubscriptionUncheckedCreateInput,
      });
      return created;
    });

    return success({ id: branch.id });
  } catch (err) {
    return handleApiError(err);
  }
}
