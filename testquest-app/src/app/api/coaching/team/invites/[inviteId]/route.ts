/**
 * POST   /api/coaching/team/invites/[inviteId]    — resend invite email
 * DELETE /api/coaching/team/invites/[inviteId]    — cancel pending invite
 *
 * OWNER only. POST is intentionally not a separate "/resend" endpoint —
 * we just have the one action on a pending invite resource for now.
 */
import { requireOrgRole } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import { resendInvite, cancelInvite, TeamError } from "@/lib/services/team.service";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ inviteId: string }> },
) {
  try {
    const session = await requireOrgRole(["OWNER"]);
    const { inviteId } = await ctx.params;
    const id = Number(inviteId);
    if (!Number.isFinite(id)) return error("Bad id", 400);
    await resendInvite(session.orgId!, id);
    return success({ resent: true });
  } catch (err) {
    if (err instanceof TeamError) return error(err.message, err.status);
    return handleApiError(err);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ inviteId: string }> },
) {
  try {
    const session = await requireOrgRole(["OWNER"]);
    const { inviteId } = await ctx.params;
    const id = Number(inviteId);
    if (!Number.isFinite(id)) return error("Bad id", 400);
    await cancelInvite(session.orgId!, id);
    return success({ cancelled: true });
  } catch (err) {
    if (err instanceof TeamError) return error(err.message, err.status);
    return handleApiError(err);
  }
}
