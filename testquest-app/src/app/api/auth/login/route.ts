import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword, signToken } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { findByEmail } from "@/lib/legacy-students";

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
      const response = success({ id: admin.id, name: admin.name, email: admin.email, role: "admin" });
      response.cookies.set("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60,
        path: "/",
      });
      return response;
    }

    // Students authenticate against the legacy `student` table (shared with mobile)
    const student = await findByEmail(body.email);
    if (!student || !student.isActive || !student.passwordHash) {
      return error("Invalid credentials", 401);
    }

    // Only bcrypt-hashed passwords are supported. Legacy plaintext rows must
    // request a password reset before logging in.
    if (!student.passwordHash.startsWith("$2")) {
      return error("Please reset your password to continue", 401);
    }

    const valid = await verifyPassword(body.password, student.passwordHash);
    if (!valid) return error("Invalid credentials", 401);

    // Phase 0.3: check if this student also has an active org membership and
    // embed orgId + orgRole in the token if so. Pick the most-privileged role
    // (OWNER > ADMIN > TEACHER > STUDENT > PARENT) when multiple exist.
    const ROLE_RANK: Record<string, number> = { OWNER: 5, ADMIN: 4, TEACHER: 3, STUDENT: 2, PARENT: 1 };
    const memberships = await prisma.orgMembership.findMany({
      where: { userId: student.id, isActive: true, org: { isActive: true } },
      select: { orgId: true, role: true },
    });
    const best = memberships.sort((a, b) => (ROLE_RANK[b.role] ?? 0) - (ROLE_RANK[a.role] ?? 0))[0];

    const token = signToken({
      id: student.id,
      email: student.email,
      role: "student",
      orgId: best?.orgId ?? null,
      orgRole: best?.role ?? null,
    });

    const response = success({
      id: student.id,
      name: student.name,
      email: student.email,
      role: "student",
      orgId: best?.orgId ?? null,
      orgRole: best?.role ?? null,
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
