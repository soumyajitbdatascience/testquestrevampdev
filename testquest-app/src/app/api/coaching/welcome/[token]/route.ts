/**
 * Public welcome endpoints (Phase 2 / Task 2.5).
 *
 *   GET  /api/coaching/welcome/[token] — resolve the token (returns org + owner)
 *   POST /api/coaching/welcome/[token] — accept; sets password, signs JWT.
 *
 * Same lifecycle as a password reset, but the destination after success is
 * `/coaching/setup` (the wizard) rather than `/login`, since this is a
 * brand-new owner whose centre was created sales-led.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, signToken } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import {
  consumePasswordResetTokenDetailed,
  findResetToken,
} from "@/lib/legacy-students";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await ctx.params;
    const resolved = await findResetToken(token);
    if (!resolved) return error("This welcome link is invalid or has expired. Ask Testquest staff to send a new one.", 410);

    // Look up the org that this student owns. If they don't own any, the
    // token still works but we route them to /tests as a student afterwards.
    const ownership = await prisma.orgMembership.findFirst({
      where: { userId: resolved.studentId, role: "OWNER", isActive: true },
      include: { org: { select: { id: true, name: true } } },
    });
    return success({
      invite: {
        name: resolved.name,
        email: resolved.email,
        orgName: ownership?.org?.name ?? null,
      },
    });
  } catch (err) {
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

    // Resolve again so we know who they are AFTER consuming the token.
    const resolved = await findResetToken(token);
    if (!resolved) return error("This welcome link is invalid or has expired. Ask Testquest staff to send a new one.", 410);

    const passwordHash = await hashPassword(body.password);
    const consumed = await consumePasswordResetTokenDetailed(token, passwordHash);
    if (!consumed) return error("Couldn't accept this link. Try again or ask for a new one.", 410);

    // Sign a JWT carrying the org context if they own one.
    const ownership = await prisma.orgMembership.findFirst({
      where: { userId: consumed.studentId, role: "OWNER", isActive: true },
    });
    const jwt = signToken({
      id:      consumed.studentId,
      email:   resolved.email.toLowerCase(),
      role:    "student",
      orgId:   ownership?.orgId,
      orgRole: ownership?.role,
    });
    const response = success({
      redirect: ownership ? "/coaching/setup" : "/tests",
    });
    response.cookies.set("token", jwt, {
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
