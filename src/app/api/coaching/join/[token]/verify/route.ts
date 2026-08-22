/**
 * POST /api/coaching/join/[token]/verify
 *
 * Final step of the student-side join flow. Verifies the OTP, resolves or
 * creates the legacy `student` row by mobile, enforces the org's seat cap,
 * and issues a session cookie. On success the browser is expected to land
 * the student on /tests where the new OrgContextBanner shows their centre.
 */
import { z } from "zod";
import { consumeJoinOtp, InviteError } from "@/lib/services/invite.service";
import { signToken } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";

type Params = { params: Promise<{ token: string }> };

const schema = z.object({
  mobile: z.string().min(10).max(20),
  code: z.string().min(4).max(8),
  name: z.string().min(2).max(200),
});

export async function POST(req: Request, { params }: Params) {
  try {
    const { token } = await params;
    const body = await parseBody(req, schema);
    const { context, result, studentEmail } = await consumeJoinOtp({
      token, mobile: body.mobile, code: body.code, name: body.name,
    });

    const jwt = signToken({
      id: result.studentId,
      email: studentEmail,
      role: "student",
      orgId: context.orgId,
      orgRole: "STUDENT",
    });

    const response = success({
      orgId: context.orgId,
      orgName: context.orgName,
      batchName: context.batchName,
      alreadyEnrolled: result.alreadyEnrolled,
      alreadyMember: result.alreadyMember,
      redirect: "/dashboard",
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
    if (err instanceof InviteError) {
      const status =
        err.code === "at_capacity" ? 403 :
        err.code === "token_expired" ? 410 :
        err.code === "invalid_token" ? 404 :
        400;
      return error(err.message, status);
    }
    return handleApiError(err);
  }
}
