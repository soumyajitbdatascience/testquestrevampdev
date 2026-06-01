/**
 * POST /api/coaching/login/otp/verify — verify the login OTP + sign a JWT.
 *
 * Phase 2 / Task 2.7. Public. On success, sets the standard "token" cookie
 * carrying orgId/orgRole if the user is a centre member, and returns the
 * destination (`/coaching/dashboard` for owners/admins/teachers, `/tests`
 * for everyone else).
 */
import { z } from "zod";
import { signToken } from "@/lib/auth";
import { parseBody, handleApiError, success, error } from "@/lib/api-utils";
import { consumeLoginOtp, LoginOtpError } from "@/lib/services/coaching-login.service";

const schema = z.object({
  mobile: z.string().min(10).max(20),
  code:   z.string().min(4).max(10),
});

export async function POST(req: Request) {
  try {
    const body = await parseBody(req, schema);
    const result = await consumeLoginOtp(body);

    const jwt = signToken({
      id:      result.studentId,
      email:   result.email.toLowerCase(),
      role:    "student",
      orgId:   result.orgId,
      orgRole: result.orgRole,
    });
    const response = success({ redirect: result.redirect });
    response.cookies.set("token", jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    return response;
  } catch (err) {
    if (err instanceof LoginOtpError) return error(err.message, err.status);
    return handleApiError(err);
  }
}
