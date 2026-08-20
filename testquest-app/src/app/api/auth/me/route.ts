import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import { findById } from "@/lib/students";

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

    // Student → tq_students
    const student = await findById(session.id);
    if (!student) return error("Unauthorized", 401);

    // Board and class live on the student's context now, not the student row.
    const ctx = student.primaryContext;
    let className: string | null = null;
    let boardCode: string | null = null;
    if (ctx) {
      const [cls, board] = await Promise.all([
        prisma.class.findUnique({ where: { id: ctx.classId }, select: { name: true } }),
        prisma.board.findUnique({ where: { id: ctx.boardId }, select: { code: true } }),
      ]);
      className = cls?.name ?? null;
      boardCode = board?.code ?? null;
    }

    // Org context is always null on this database: the coaching/B2B stack has
    // no tables here, so resolving it would fail on every call. Login no longer
    // issues org claims either.
    const org: { id: number; name: string; role: string } | null = null;

    return success({
      id: student.id,
      name: student.name,
      email: student.email,
      mobile: student.mobile,
      emailVerified: student.emailVerified,
      classId: ctx?.classId ?? null,
      boardId: ctx?.boardId ?? null,
      board: boardCode,
      // tq_students has no avatar column; Google pictures are not stored.
      avatarUrl: null,
      class: className && ctx ? { id: ctx.classId, name: className } : null,
      role: "student",
      // `displayRole` used to become the coaching-centre membership role when
      // one existed. With that stack absent, a student is only ever a student.
      displayRole: "student",
      needsProfile: ctx == null,
      org,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
