/**
 * organization-hierarchy service — Phase 4 / Task 4.4 (multi-branch support).
 *
 * Parent orgs can host one or more child orgs ("branches"). OWNER/ADMIN of the
 * parent cascade into every child; TEACHER does not cascade. STUDENT/PARENT
 * roles are content-side and never cascade through the hierarchy.
 *
 * Schema note: `Organization.parentOrgId` already exists — this service only
 * adds read/aggregate helpers + a single access-check predicate used by
 * `requireOrgAccessForOrg` in `lib/auth.ts`.
 */
import { prisma } from "@/lib/db";
import type { SubscriptionStatus } from "@/generated/prisma/client";

export interface BranchSummary {
  id: number;
  name: string;
  city: string | null;
  memberCount: number;
  batchCount: number;
  subscriptionStatus: SubscriptionStatus | null;
  subscriptionPlanName: string | null;
}

export async function listBranches(parentOrgId: number): Promise<BranchSummary[]> {
  const orgs = await prisma.organization.findMany({
    where: { parentOrgId, isActive: true },
    include: {
      subscriptions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { plan: { select: { name: true } } },
      },
      _count: {
        select: {
          memberships: { where: { isActive: true, role: { in: ["OWNER", "ADMIN", "TEACHER"] } } },
          batches: { where: { isActive: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return orgs.map((o) => {
    const sub = o.subscriptions[0];
    return {
      id: o.id,
      name: o.name,
      city: o.city,
      memberCount: o._count.memberships,
      batchCount: o._count.batches,
      subscriptionStatus: sub?.status ?? null,
      subscriptionPlanName: sub?.plan?.name ?? null,
    };
  });
}

/**
 * True if the user has an active OrgMembership directly on `targetOrgId`,
 * OR an active OWNER/ADMIN OrgMembership on the target's parent org.
 * TEACHER role does NOT cascade through the hierarchy.
 */
export async function userCanAccessOrg(userId: number, targetOrgId: number): Promise<boolean> {
  const direct = await prisma.orgMembership.findFirst({
    where: { userId, orgId: targetOrgId, isActive: true },
    select: { id: true },
  });
  if (direct) return true;

  const target = await prisma.organization.findUnique({
    where: { id: targetOrgId },
    select: { parentOrgId: true },
  });
  if (!target?.parentOrgId) return false;

  const parentMembership = await prisma.orgMembership.findFirst({
    where: {
      userId,
      orgId: target.parentOrgId,
      isActive: true,
      role: { in: ["OWNER", "ADMIN"] },
    },
    select: { id: true },
  });
  return !!parentMembership;
}

export async function getOrgWithParent(
  orgId: number,
): Promise<{ id: number; name: string; parentOrgId: number | null } | null> {
  return prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true, parentOrgId: true },
  });
}
