/**
 * Public accept-invite endpoints (no auth — the invitee is establishing one).
 *
 *   GET  /api/coaching/team/accept/[token]   — resolve invite metadata
 *   POST /api/coaching/team/accept/[token]   — accept; sets password, writes
 *                                              membership, signs a JWT cookie.
 *
 * On accept the user lands on /coaching/dashboard with their JWT carrying
 * orgId + orgRole.
 */
import { z } from "zod";
import { signToken } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import {
  resolveTeamInvite,
  acceptTeamInvite,
  TeamError,
} from "@/lib/services/team.service";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await ctx.params;
    const invite = await resolveTeamInvite(token);
    return success({ invite });
  } catch (err) {
    if (err instanceof TeamError) return error(err.message, err.status);
    return handleApiError(err);
  }
}

const acceptSchema = z.object({
  password: z.string().min(6).max(100),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await ctx.params;
    const body = await parseBody(req, acceptSchema);
    const result = await acceptTeamInvite({ token, password: body.password });

    const jwt = signToken({
      id:      result.userId,
      email:   result.email,
      role:    "student",
      orgId:   result.orgId,
      orgRole: result.orgRole,
    });
    const response = success({ redirect: "/coaching/dashboard" });
    response.cookies.set("token", jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    return response;
  } catch (err) {
    if (err instanceof TeamError) return error(err.message, err.status);
    return handleApiError(err);
  }
}
