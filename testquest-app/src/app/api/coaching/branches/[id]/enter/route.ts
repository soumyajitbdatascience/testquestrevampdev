/**
 * POST /api/coaching/branches/[id]/enter — Task 4.4.
 *
 * Switch the caller's session into a different org. Allowed if the caller has
 * direct membership on the target, OR is OWNER/ADMIN of the target's parent
 * (cascade from parent down — see `userCanAccessOrg`). We re-sign the JWT with
 * the new orgId + orgRole and rewrite the cookie, then return the redirect URL.
 *
 * When the user only has cascade access (no direct membership), we surface
 * them as OWNER inside the child — they're a parent-level admin acting on the
 * branch.
 */
import { cookies } from "next/headers";
import { getSession, signToken } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import { prisma } from "@/lib/db";
import { userCanAccessOrg } from "@/lib/services/organization-hierarchy.service";

const COOKIE_NAME = "token";
const JWT_EXPIRES_IN_SECONDS = 7 * 24 * 60 * 60;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return error("Unauthorized", 401);

    const { id } = await ctx.params;
    const targetOrgId = Number(id);
    if (!Number.isFinite(targetOrgId)) return error("Bad id", 400);

    const ok = await userCanAccessOrg(session.id, targetOrgId);
    if (!ok) return error("Forbidden", 403);

    // Resolve the role: direct membership wins; cascade falls back to OWNER.
    const direct = await prisma.orgMembership.findFirst({
      where: { userId: session.id, orgId: targetOrgId, isActive: true },
      select: { role: true },
    });
    const orgRole = direct?.role ?? "OWNER";

    const token = signToken({
      id: session.id,
      email: session.email,
      role: session.role,
      orgId: targetOrgId,
      orgRole,
    });

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: JWT_EXPIRES_IN_SECONDS,
    });

    return success({ redirect: "/coaching/dashboard" });
  } catch (err) {
    return handleApiError(err);
  }
}
