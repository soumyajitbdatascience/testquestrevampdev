import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success } from "@/lib/api-utils";

const patchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  chapterId: z.number().int().positive().nullable().optional(),
  durationSeconds: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const body = await parseBody(request, patchSchema);
    const video = await prisma.video.update({ where: { id: Number(id) }, data: body });
    return success(video);
  } catch (err) {
    return handleApiError(err);
  }
}

/** Deactivate (archive) — replacement = paste the new URL as a fresh video. */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    await prisma.video.update({ where: { id: Number(id) }, data: { isActive: false } });
    return success({ archived: true });
  } catch (err) {
    return handleApiError(err);
  }
}
