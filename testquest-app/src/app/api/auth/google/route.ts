import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import { signToken } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { findByEmail, createLegacyStudent, updateLegacyStudent } from "@/lib/legacy-students";

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
    const picture = payload.picture || null;

    // Find by email in the legacy student table; create if missing
    let student = await findByEmail(email);
    let studentId: number;

    if (student) {
      studentId = student.id;
      // Sync avatar from Google on each login if absent
      if (!student.avatarUrl && picture) {
        await updateLegacyStudent(student.id, { avatarUrl: picture });
      }
    } else {
      studentId = await createLegacyStudent({
        name,
        email,
        avatarUrl: picture,
        // No password — Google-only account. User must set one via password
        // reset before they can log in with email/password.
      });
      student = await findByEmail(email);
    }

    const needsProfile = !student?.classId;

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
