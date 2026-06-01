/**
 * GET /api/coaching/join/[token]
 *
 * Resolve the invite token and return the centre + batch context so the
 * landing page can render before the student commits to anything. Public —
 * no auth required (anyone with the link can see the landing page).
 *
 * Errors return 410 for an expired link and 404 for an unknown one.
 */
import { resolveInviteToken, InviteError } from "@/lib/services/invite.service";
import { handleApiError, success, error } from "@/lib/api-utils";

type Params = { params: Promise<{ token: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { token } = await params;
    const ctx = await resolveInviteToken(token);
    return success({
      orgName: ctx.orgName,
      orgLogoUrl: ctx.orgLogoUrl,
      batchName: ctx.batchName,
      expiresAt: ctx.expiresAt,
    });
  } catch (err) {
    if (err instanceof InviteError) {
      return error(err.message, err.code === "token_expired" ? 410 : 404);
    }
    return handleApiError(err);
  }
}
