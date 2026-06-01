/**
 * POST /api/coaching/login/otp — request a login OTP for a mobile number.
 *
 * Phase 2 / Task 2.7. Public; no auth required. Throws if the mobile doesn't
 * match an active student account so the UI can be honest (rather than
 * silently letting the user type a code that never works).
 */
import { z } from "zod";
import { parseBody, handleApiError, success, error } from "@/lib/api-utils";
import { issueLoginOtp, LoginOtpError } from "@/lib/services/coaching-login.service";

const schema = z.object({
  mobile: z.string().min(10).max(20),
});

export async function POST(req: Request) {
  try {
    const body = await parseBody(req, schema);
    const result = await issueLoginOtp(body.mobile);
    return success(result);
  } catch (err) {
    if (err instanceof LoginOtpError) return error(err.message, err.status);
    return handleApiError(err);
  }
}
