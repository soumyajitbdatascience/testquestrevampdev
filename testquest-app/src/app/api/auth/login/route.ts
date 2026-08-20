import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword, signToken } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { findByEmail } from "@/lib/students";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  role: z.enum(["student", "admin"]).default("student"),
});

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, loginSchema);

    // Admins still live in tq_admins (web-only role, separate from legacy mobile)
    if (body.role === "admin") {
      const admin = await prisma.admin.findUnique({ where: { email: body.email } });
      if (!admin || !admin.isActive) return error("Invalid credentials", 401);

      const valid = await verifyPassword(body.password, admin.passwordHash);
      if (!valid) return error("Invalid credentials", 401);

      const token = signToken({ id: admin.id, email: admin.email, role: "admin" });
      const response = success({ id: admin.id, name: admin.name, email: admin.email, role: "admin", token });
      response.cookies.set("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60,
        path: "/",
      });
      return response;
    }

    // Students authenticate against tq_students.
    const student = await findByEmail(body.email);
    if (!student || !student.isActive || !student.passwordHash) {
      return error("Invalid credentials", 401);
    }

    // Only bcrypt hashes are accepted.
    if (!student.passwordHash.startsWith("$2")) {
      return error("Please reset your password to continue", 401);
    }

    const valid = await verifyPassword(body.password, student.passwordHash);
    if (!valid) return error("Invalid credentials", 401);

    // The org-membership lookup that used to enrich this token is gone: the
    // coaching/B2B stack has no tables in the decoupled database, so querying
    // it here would fail every student login. Org claims stay null until that
    // feature is rebuilt.
    const token = signToken({
      id: student.id,
      email: student.email,
      role: "student",
      orgId: null,
      orgRole: null,
    });

    const response = success({
      id: student.id,
      name: student.name,
      email: student.email,
      role: "student",
      orgId: null,
      orgRole: null,
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
