import { z } from "zod";
import { handleApiError, parseBody, success } from "@/lib/api-utils";
import { sendPasswordReset } from "@/lib/email-lifecycle";
import { findByEmail, createPasswordResetToken } from "@/lib/students";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const { email } = await parseBody(request, schema);

    // Always return the same response to prevent email enumeration
    const student = await findByEmail(email);
    if (!student) return success({ message: "If the email exists, a reset link has been sent" });

    // The token is a tq_email_tokens row now, so it expires and is consumed
    // independently of the student record.
    const token = await createPasswordResetToken(student.id);
    // Failure to send must not reveal whether the address exists, so the
    // response is identical either way.
    try {
      await sendPasswordReset(student.id, token);
    } catch (e) {
      console.error("Password reset email failed:", e);
    }

    return success({ message: "If the email exists, a reset link has been sent" });
  } catch (err) {
    return handleApiError(err);
  }
}
