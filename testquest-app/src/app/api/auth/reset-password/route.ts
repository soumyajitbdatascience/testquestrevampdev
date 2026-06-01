import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { consumePasswordResetToken } from "@/lib/legacy-students";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(6).max(100),
});

export async function POST(request: Request) {
  try {
    const { token, password } = await parseBody(request, schema);
    const passwordHash = await hashPassword(password);

    const ok = await consumePasswordResetToken(token, passwordHash);
    if (!ok) return error("Invalid or expired reset link", 400);

    return success({ message: "Password updated successfully" });
  } catch (err) {
    return handleApiError(err);
  }
}
