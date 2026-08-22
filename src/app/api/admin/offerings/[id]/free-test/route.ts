import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

/**
 * The one free sample test for an offering.
 *
 * The sample is the shop window — it is what a student can sit before paying.
 * So only a live test that actually has questions can be chosen; anything else
 * would show a prospective buyer an empty test.
 */
const putSchema = z.object({
  testId: z.number().int().positive().nullable(), // null clears the sample
});

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const offeringId = Number(id);
    if (!Number.isFinite(offeringId)) return error("Invalid offering id", 400);

    const [current, candidates] = await Promise.all([
      prisma.freeTest.findUnique({
        where: { offeringId },
        include: { test: { select: { id: true, name: true, durationMinutes: true, totalMarks: true } } },
      }),
      prisma.test.findMany({
        where: { offeringId, isActive: true, questions: { some: {} } },
        orderBy: { name: "asc" },
        include: { _count: { select: { questions: true, attempts: true } } },
      }),
    ]);

    return success({
      current: current
        ? {
            testId: current.test.id,
            name: current.test.name,
            durationMinutes: current.test.durationMinutes,
            totalMarks: current.test.totalMarks,
          }
        : null,
      candidates: candidates.map((t) => ({
        id: t.id,
        name: t.name,
        durationMinutes: t.durationMinutes,
        totalMarks: t.totalMarks,
        questionCount: t._count.questions,
        attemptCount: t._count.attempts,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const offeringId = Number(id);

    const offering = await prisma.offering.findUnique({ where: { id: offeringId }, select: { id: true } });
    if (!offering) return error("Offering not found", 404);

    const body = await parseBody(request, putSchema);

    if (body.testId == null) {
      await prisma.freeTest.deleteMany({ where: { offeringId } });
      return success({ cleared: true });
    }

    const test = await prisma.test.findFirst({
      where: { id: body.testId, offeringId, isActive: true },
      include: { _count: { select: { questions: true } } },
    });
    if (!test) return error("Pick a live test that belongs to this offering", 400);
    if (test._count.questions === 0) {
      return error("That test has no questions — a sample must be something a student can actually sit.", 400);
    }

    await prisma.freeTest.upsert({
      where: { offeringId },
      create: { offeringId, testId: body.testId },
      update: { testId: body.testId },
    });

    return success({ set: true, testId: body.testId });
  } catch (err) {
    return handleApiError(err);
  }
}
