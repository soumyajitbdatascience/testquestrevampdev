import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string; chapterId: string }> };

const updateSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  sortOrder: z.number().int().optional(),
});

/** Loads the chapter and proves it belongs to this offering. */
async function ownedChapter(offeringId: number, chapterId: number) {
  if (!Number.isFinite(offeringId) || !Number.isFinite(chapterId)) return null;
  return prisma.chapter.findFirst({ where: { id: chapterId, offeringId }, select: { id: true } });
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id, chapterId } = await params;
    const chapter = await ownedChapter(Number(id), Number(chapterId));
    if (!chapter) return error("Chapter not found in this offering", 404);

    const body = await parseBody(request, updateSchema);
    const updated = await prisma.chapter.update({ where: { id: chapter.id }, data: body });
    return success(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Archive, not delete. Questions keep pointing at the chapter row, so nothing
 * is orphaned; the chapter simply stops appearing in the list. Refuses if
 * questions still carry it, so the count never silently drops.
 */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id, chapterId } = await params;
    const chapter = await ownedChapter(Number(id), Number(chapterId));
    if (!chapter) return error("Chapter not found in this offering", 404);

    const tagged = await prisma.question.count({ where: { chapterId: chapter.id, isActive: true } });
    if (tagged > 0) {
      return error(
        `${tagged} question(s) are still tagged to this chapter. Move them to another chapter first.`,
        409,
      );
    }

    await prisma.chapter.update({ where: { id: chapter.id }, data: { isActive: false } });
    return success({ archived: true });
  } catch (err) {
    return handleApiError(err);
  }
}
