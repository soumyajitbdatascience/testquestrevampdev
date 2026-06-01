import { z } from "zod";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success } from "@/lib/api-utils";
import { createSubject } from "@/lib/legacy-admin";

const createSchema = z.object({
  classId: z.number().int().positive(),
  name: z.string().min(1).max(200),
  sortOrder: z.number().int().optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAuth("admin");
    const params = request.nextUrl.searchParams;
    const classId = params.get("classId");
    const search = params.get("search");
    const page = Math.max(1, Number(params.get("page") || "1"));
    const limit = Math.min(200, Math.max(1, Number(params.get("limit") || "50")));
    const offset = (page - 1) * limit;

    const whereParts: string[] = [];
    const args: (string | number)[] = [];
    if (classId) { whereParts.push("s.classId = ?"); args.push(Number(classId)); }
    if (search) { whereParts.push("s.name LIKE ?"); args.push(`%${search}%`); }
    const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    const rows = await prisma.$queryRawUnsafe<Array<{
      id: number; name: string; classId: number | null; isActive: number | boolean;
      className: string | null;
      chapters: bigint; tests: bigint;
    }>>(
      `SELECT s.id, s.name, s.classId, s.isActive,
              c.name AS className,
              0 AS chapters,
              (SELECT COUNT(*) FROM vw_tests t WHERE t.subjectId = s.id) AS tests
       FROM vw_subjects s
       LEFT JOIN vw_classes c ON c.id = s.classId
       ${whereClause}
       ORDER BY s.name
       LIMIT ${limit} OFFSET ${offset}`,
      ...args,
    );
    return success(rows.map(r => ({
      id: Number(r.id),
      name: r.name,
      classId: r.classId !== null ? Number(r.classId) : null,
      class: r.classId !== null ? { id: Number(r.classId), name: r.className || `Class ${r.classId}` } : null,
      sortOrder: 0,
      isActive: !!r.isActive,
      _count: {
        chapters: Number(r.chapters),
        tests: Number(r.tests),
      },
    })));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth("admin");
    const body = await parseBody(request, createSchema);
    const newId = await createSubject({ name: body.name, classId: body.classId });
    return success({ id: newId, name: body.name, classId: body.classId, isActive: true }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
