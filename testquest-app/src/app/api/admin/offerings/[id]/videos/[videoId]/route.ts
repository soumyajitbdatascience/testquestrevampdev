import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string; videoId: string }> };

const updateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  chapterId: z.number().int().positive().nullable().optional(),
  durationSeconds: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id, videoId } = await params;
    const offeringId = Number(id);

    const video = await prisma.video.findFirst({
      where: { id: Number(videoId), offeringId },
      select: { id: true },
    });
    if (!video) return error("Video not found in this offering", 404);

    const body = await parseBody(request, updateSchema);

    if (body.chapterId != null) {
      const chapter = await prisma.chapter.findFirst({
        where: { id: body.chapterId, offeringId },
        select: { id: true },
      });
      if (!chapter) return error("That chapter is not in this offering", 400);
    }

    const updated = await prisma.video.update({ where: { id: video.id }, data: body });
    return success(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

/** Videos carry no history worth preserving, so this really does remove the row. */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id, videoId } = await params;
    const offeringId = Number(id);

    const video = await prisma.video.findFirst({
      where: { id: Number(videoId), offeringId },
      select: { id: true },
    });
    if (!video) return error("Video not found in this offering", 404);

    await prisma.video.delete({ where: { id: video.id } });
    return success({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
