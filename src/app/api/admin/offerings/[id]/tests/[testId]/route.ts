import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string; testId: string }> };

const updateSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  description: z.string().nullable().optional(),
  durationMinutes: z.number().int().min(1).max(600).optional(),
  isPractice: z.boolean().optional(),
  isFree: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

/** Loads the test and proves it belongs to this offering. */
async function ownedTest(offeringId: number, testId: number) {
  if (!Number.isFinite(offeringId) || !Number.isFinite(testId)) return null;
  return prisma.test.findFirst({ where: { id: testId, offeringId }, select: { id: true } });
}

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id, testId } = await params;
    const offeringId = Number(id);

    const test = await prisma.test.findFirst({
      where: { id: Number(testId), offeringId },
      include: {
        _count: { select: { questions: true, attempts: true } },
        freeTests: { select: { id: true } },
      },
    });
    if (!test) return error("Test not found in this offering", 404);

    return success({
      id: test.id,
      name: test.name,
      description: test.description,
      durationMinutes: test.durationMinutes,
      totalMarks: test.totalMarks,
      isFree: test.isFree,
      isPractice: test.isPractice,
      isActive: test.isActive,
      questionCount: test._count.questions,
      attemptCount: test._count.attempts,
      isFreeSample: test.freeTests.length > 0,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id, testId } = await params;
    const test = await ownedTest(Number(id), Number(testId));
    if (!test) return error("Test not found in this offering", 404);

    const body = await parseBody(request, updateSchema);

    // A test with no questions must not go live — a student would open it and
    // find nothing to answer.
    if (body.isActive === true) {
      const questionCount = await prisma.testQuestion.count({ where: { testId: test.id } });
      if (questionCount === 0) {
        return error("Add at least one question before making this test live", 409);
      }
    }

    const updated = await prisma.test.update({ where: { id: test.id }, data: body });
    return success(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Archive, not delete. A test that has been attempted must keep its row so the
 * attempt history still resolves; and the free sample must be reassigned
 * first, otherwise the offering silently loses its sample.
 */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id, testId } = await params;
    const test = await ownedTest(Number(id), Number(testId));
    if (!test) return error("Test not found in this offering", 404);

    const isSample = await prisma.freeTest.findFirst({ where: { testId: test.id }, select: { id: true } });
    if (isSample) {
      return error("This test is the offering's free sample. Pick a different sample first.", 409);
    }

    await prisma.test.update({ where: { id: test.id }, data: { isActive: false } });
    return success({ archived: true });
  } catch (err) {
    return handleApiError(err);
  }
}
