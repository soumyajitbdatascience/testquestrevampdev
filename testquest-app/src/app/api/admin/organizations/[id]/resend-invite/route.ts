/**
 * POST /api/admin/organizations/[id]/resend-invite — re-send the welcome
 * magic link to the centre's owner (sales-led only; rejected if the owner
 * has already set their password).
 */
import { requireAuth } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import { resendOwnerInvite, OrgAdminError } from "@/lib/services/organization-admin.service";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("admin");
    const { id } = await ctx.params;
    const orgId = Number(id);
    if (!Number.isFinite(orgId)) return error("Bad id", 400);
    const result = await resendOwnerInvite(orgId);
    return success(result);
  } catch (err) {
    if (err instanceof OrgAdminError) return error(err.message, err.status);
    return handleApiError(err);
  }
}
