import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(), // false = archive (never delete)
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const body = await parseBody(request, patchSchema);
    const chapter = await prisma.chapter.update({ where: { id: Number(id) }, data: body });
    return success(chapter);
  } catch (err) {
    return handleApiError(err);
  }
}

/** Archive (soft) — tagging rows are kept so un-archiving restores intact. */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const chapter = await prisma.chapter.findUnique({ where: { id: Number(id) } });
    if (!chapter) return error("Chapter not found", 404);
    await prisma.chapter.update({ where: { id: chapter.id }, data: { isActive: false } });
    return success({ archived: true });
  } catch (err) {
    return handleApiError(err);
  }
}
