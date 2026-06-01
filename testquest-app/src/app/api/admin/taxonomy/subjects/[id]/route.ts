import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { updateSubject, softDeleteSubject } from "@/lib/legacy-admin";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  classId: z.number().int().positive().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const sid = Number(id);
    const rows = await prisma.$queryRaw<Array<{
      id: number; name: string; classId: number | null; isActive: number | boolean;
      className: string | null;
    }>>`
      SELECT s.id, s.name, s.classId, s.isActive, c.name AS className
      FROM vw_subjects s
      LEFT JOIN vw_classes c ON c.id = s.classId
      WHERE s.id = ${sid} LIMIT 1
    `;
    if (!rows[0]) return error("Subject not found", 404);
    const r = rows[0];
    return success({
      id: Number(r.id),
      name: r.name,
      classId: r.classId !== null ? Number(r.classId) : null,
      class: r.classId !== null ? { id: Number(r.classId), name: r.className || `Class ${r.classId}` } : null,
      isActive: !!r.isActive,
      chapters: [],
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const body = await parseBody(request, updateSchema);
    await updateSubject(Number(id), {
      name: body.name, classId: body.classId, isActive: body.isActive,
    });
    return success({ id: Number(id), ...body });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    await softDeleteSubject(Number(id));
    return success({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
