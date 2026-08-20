import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().min(1).max(20).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const body = await parseBody(request, patchSchema);
    const board = await prisma.board.update({
      where: { id: Number(id) },
      data: {
        ...(body.name != null ? { name: body.name } : {}),
        ...(body.code != null ? { code: body.code.toUpperCase() } : {}),
        ...(body.sortOrder != null ? { sortOrder: body.sortOrder } : {}),
        ...(body.isActive != null ? { isActive: body.isActive } : {}),
      },
    });
    return success(board);
  } catch (err) {
    return handleApiError(err);
  }
}

/** Deactivate only — boards are never deleted (2g guard: passes keep working). */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const board = await prisma.board.findUnique({ where: { id: Number(id) } });
    if (!board) return error("Board not found", 404);
    await prisma.board.update({ where: { id: board.id }, data: { isActive: false } });
    return success({ deactivated: true });
  } catch (err) {
    return handleApiError(err);
  }
}
