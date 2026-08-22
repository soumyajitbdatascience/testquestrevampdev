/**
 * POST /api/coaching/join/[token]/otp
 *
 * Issues a 6-digit OTP for the supplied mobile, scoped to this join token.
 * Public route — invite-token presence is the only auth.
 *
 * Dev convenience: when `NODE_ENV !== "production"` the API includes the OTP
 * itself in the response so the join flow can be tested without a real SMS
 * provider. Production responses never echo the code.
 */
import { z } from "zod";
import { issueJoinOtp, InviteError } from "@/lib/services/invite.service";
import { isSmsDevMode } from "@/lib/sms";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";

type Params = { params: Promise<{ token: string }> };

const schema = z.object({
  mobile: z.string().min(10).max(20),
});

export async function POST(req: Request, { params }: Params) {
  try {
    const { token } = await params;
    const body = await parseBody(req, schema);
    const { codeForDev } = await issueJoinOtp(token, body.mobile);
    const payload: { sent: boolean; devOtp?: string } = { sent: true };
    if (isSmsDevMode()) payload.devOtp = codeForDev;
    return success(payload);
  } catch (err) {
    if (err instanceof InviteError) {
      return error(err.message, err.code === "token_expired" ? 410 : 404);
    }
    return handleApiError(err);
  }
}
