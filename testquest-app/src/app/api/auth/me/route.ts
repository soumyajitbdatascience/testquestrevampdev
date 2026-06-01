import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import { findById } from "@/lib/legacy-students";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return error("Unauthorized", 401);

    if (session.role === "admin") {
      const admin = await prisma.admin.findUnique({
        where: { id: session.id },
        select: { id: true, name: true, email: true },
      });
      if (!admin) return error("Unauthorized", 401);
      // `role` mirrors the JWT/source-table value; `displayRole` is the role the
      // UI should show/route on (lowercase: owner | admin | teacher | student).
      return success({ ...admin, role: "admin", displayRole: "admin" });
    }

    // Student → legacy `student` table
    const student = await findById(session.id);
    if (!student) return error("Unauthorized", 401);

    let className: string | null = null;
    if (student.classId) {
      const r = await prisma.$queryRaw<Array<{ name: string }>>`
        SELECT name FROM vw_classes WHERE id = ${student.classId} LIMIT 1
      `;
      className = r[0]?.name ?? null;
    }

    // Org context — set when this student is a member of a coaching centre
    // (joined via /coaching/join/[token]). The JWT also carries orgId/orgRole,
    // but we re-resolve here so a stale or absent JWT claim doesn't matter.
    let org: { id: number; name: string; role: string } | null = null;
    if (session.orgId && session.orgRole) {
      const orgRow = await prisma.organization.findUnique({
        where: { id: session.orgId },
        select: { id: true, name: true },
      });
      if (orgRow) org = { id: orgRow.id, name: orgRow.name, role: session.orgRole };
    }

    return success({
      id: student.id,
      name: student.name,
      email: student.email,
      mobile: student.mobile,
      classId: student.classId,
      board: student.board,
      avatarUrl: student.avatarUrl,
      class: className && student.classId ? { id: student.classId, name: className } : null,
      role: "student",
      // Best role for the UI to display/route on. Owner rows live in the legacy
      // `student` table, so top-level `role` is always "student"; the real role
      // for a coaching-centre member is the org membership role. Lowercased to
      // match the admin branch ("admin") and keep client checks consistent.
      displayRole: org ? org.role.toLowerCase() : "student",
      needsProfile: !student.classId,
      org,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
