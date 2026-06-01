import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success } from "@/lib/api-utils";
import { createClass } from "@/lib/legacy-admin";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  sortOrder: z.number().int().optional(),
});

export async function GET() {
  try {
    await requireAuth("admin");
    const rows = await prisma.$queryRaw<Array<{
      id: number; name: string; isActive: number | boolean; sortOrder: number;
      subjects: bigint; students: bigint; tests: bigint;
    }>>`
      SELECT
        c.id, c.name, c.isActive, c.sortOrder,
        (SELECT COUNT(*) FROM vw_subjects s WHERE s.classId = c.id) AS subjects,
        (SELECT COUNT(*) FROM student st WHERE st.category_id = c.id) AS students,
        (SELECT COUNT(*) FROM vw_tests t WHERE t.classId = c.id) AS tests
      FROM vw_classes c
      ORDER BY c.sortOrder
    `;
    return success(rows.map(r => ({
      id: Number(r.id),
      name: r.name,
      isActive: !!r.isActive,
      sortOrder: Number(r.sortOrder),
      _count: {
        subjects: Number(r.subjects),
        students: Number(r.students),
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
    const newId = await createClass({ name: body.name });
    return success({ id: newId, name: body.name, isActive: true, sortOrder: newId }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
