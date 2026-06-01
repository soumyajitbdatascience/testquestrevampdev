import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { updateClass, softDeleteClass } from "@/lib/legacy-admin";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const cid = Number(id);
    const rows = await prisma.$queryRaw<Array<{ id: number; name: string; isActive: number | boolean; sortOrder: number }>>`
      SELECT id, name, isActive, sortOrder FROM vw_classes WHERE id = ${cid} LIMIT 1
    `;
    if (!rows[0]) return error("Class not found", 404);

    const subjects = await prisma.$queryRaw<Array<{ id: number; name: string; isActive: number | boolean }>>`
      SELECT id, name, isActive FROM vw_subjects WHERE classId = ${cid} ORDER BY name
    `;

    return success({
      id: Number(rows[0].id),
      name: rows[0].name,
      isActive: !!rows[0].isActive,
      sortOrder: Number(rows[0].sortOrder),
      subjects: subjects.map(s => ({ id: Number(s.id), name: s.name, isActive: !!s.isActive })),
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
    await updateClass(Number(id), { name: body.name, isActive: body.isActive });
    return success({ id: Number(id), ...body });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    await softDeleteClass(Number(id));
    return success({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
