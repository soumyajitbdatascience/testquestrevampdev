import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import { signToken } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { findByEmail, findByGoogleId, createStudent, updateStudent } from "@/lib/students";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const schema = z.object({
  idToken: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const { idToken } = await parseBody(request, schema);

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.email_verified) {
      return error("Invalid Google token", 401);
    }

    const email = payload.email.toLowerCase();
    const name = payload.name || email;
    const googleId = payload.sub;

    // Match on the Google subject first — it is stable even if the account's
    // email changes. Fall back to email so an existing password account links
    // to Google rather than colliding on the unique email.
    let student = (await findByGoogleId(googleId)) ?? (await findByEmail(email));
    let studentId: number;

    if (student) {
      studentId = student.id;
      // Link the Google identity on first Google sign-in, and trust Google's
      // verification of the address.
      if (!student.googleId || !student.emailVerified) {
        await updateStudent(student.id, { googleId, emailVerified: true });
      }
    } else {
      studentId = await createStudent({
        name,
        email,
        googleId,
        emailVerified: true,
        // No password — Google-only account. The user must set one via
        // password reset before they can sign in with email/password.
      });
      student = await findByGoogleId(googleId);
    }

    const needsProfile = student?.primaryContext == null;

    const token = signToken({
      id: studentId,
      email,
      role: "student",
    });

    const response = success({
      id: studentId,
      name: student?.name ?? name,
      email,
      role: "student",
      needsProfile,
      // For mobile clients that can't read the httpOnly cookie
      token,
    });

    response.cookies.set("token", token, {
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
