import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

/**
 * One offering — the workspace header payload: the breadcrumb, plus the counts
 * that drive the tab badges and the readiness ring.
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const offeringId = Number(id);
    if (!Number.isFinite(offeringId)) return error("Invalid offering id", 400);

    const offering = await prisma.offering.findUnique({
      where: { id: offeringId },
      include: {
        board: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        freeTest: { select: { testId: true } },
        _count: { select: { chapters: true, tests: true, videos: true } },
      },
    });
    if (!offering) return error("Offering not found", 404);

    // `questions` is what belongs to THIS shelf — questions carrying one of its
    // chapters. `subjectBank` is the wider shared pool the subject can draw
    // from, which spans every class offering the same subject; it is shown as
    // context, never as this offering's own total.
    const [questions, subjectBank] = await Promise.all([
      prisma.question.count({ where: { isActive: true, chapter: { offeringId } } }),
      prisma.question.count({ where: { subjectId: offering.subjectId, isActive: true } }),
    ]);

    return success({
      id: offering.id,
      isActive: offering.isActive,
      board: offering.board,
      class: offering.class,
      subject: offering.subject,
      label: `${offering.board.code} ▸ ${offering.class.name} ▸ ${offering.subject.name}`,
      counts: {
        chapters: offering._count.chapters,
        tests: offering._count.tests,
        videos: offering._count.videos,
        questions,
        subjectBank,
      },
      freeTestId: offering.freeTest?.testId ?? null,
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
    const updated = await prisma.offering.update({ where: { id: Number(id) }, data: body });
    return success(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Archive, not delete — an offering with content must keep it. Refuses while
 * chapters or tests still hang off the shelf.
 */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const offeringId = Number(id);

    const counts = await prisma.offering.findUnique({
      where: { id: offeringId },
      select: { _count: { select: { chapters: true, tests: true, videos: true } } },
    });
    if (!counts) return error("Offering not found", 404);
    const { chapters, tests, videos } = counts._count;
    if (chapters + tests + videos > 0) {
      return error(
        `This offering still holds ${chapters} chapter(s), ${tests} test(s) and ${videos} video(s). Move or remove them first.`,
        409,
      );
    }

    await prisma.offering.update({ where: { id: offeringId }, data: { isActive: false } });
    return success({ archived: true });
  } catch (err) {
    return handleApiError(err);
  }
}
