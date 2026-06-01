import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, success } from "@/lib/api-utils";

/**
 * Admin: paginated student list. Reads from legacy `student` via vw_students
 * since the tq_students Prisma table is unused (real students live in legacy,
 * shared with the mobile app).
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth("admin");
    const params = request.nextUrl.searchParams;
    const search = params.get("search");
    const classId = params.get("classId");
    const page = Math.max(1, Number(params.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, Number(params.get("limit") || "20")));
    const offset = (page - 1) * limit;

    const whereParts: string[] = ["isActive = 1"];
    const args: (string | number)[] = [];
    if (classId) { whereParts.push("classId = ?"); args.push(Number(classId)); }
    if (search) {
      whereParts.push("(name LIKE ? OR email LIKE ? OR mobile LIKE ?)");
      args.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    const where = whereParts.join(" AND ");

    const rows = await prisma.$queryRawUnsafe<Array<{
      id: number; name: string; email: string; mobile: string | null;
      classId: number | null; createdAt: Date | null;
    }>>(
      `SELECT id, name, email, mobile, classId, createdAt
       FROM vw_students
       WHERE ${where}
       ORDER BY createdAt DESC
       LIMIT ${limit} OFFSET ${offset}`,
      ...args,
    );
    const totalRow = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
      `SELECT COUNT(*) AS cnt FROM vw_students WHERE ${where}`,
      ...args,
    );
    const total = Number(totalRow[0]?.cnt ?? 0);

    return success({
      students: rows.map((r) => ({
        id: Number(r.id),
        name: r.name,
        email: r.email,
        mobile: r.mobile,
        classId: r.classId !== null ? Number(r.classId) : null,
        createdAt: r.createdAt,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
