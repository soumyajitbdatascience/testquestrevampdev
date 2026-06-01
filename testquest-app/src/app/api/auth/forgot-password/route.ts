import crypto from "crypto";
import { z } from "zod";
import { handleApiError, parseBody, success } from "@/lib/api-utils";
import { sendPasswordResetEmail } from "@/lib/mail";
import { findByEmail, setPasswordResetToken } from "@/lib/legacy-students";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const { email } = await parseBody(request, schema);

    // Always return the same response to prevent email enumeration
    const student = await findByEmail(email);
    if (!student) return success({ message: "If the email exists, a reset link has been sent" });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const ok = await setPasswordResetToken(email, token, expiresAt);
    if (ok) {
      try {
        await sendPasswordResetEmail(email, token);
      } catch (e) {
        console.error("Password reset email failed:", e);
      }
    }

    return success({ message: "If the email exists, a reset link has been sent" });
  } catch (err) {
    return handleApiError(err);
  }
}
