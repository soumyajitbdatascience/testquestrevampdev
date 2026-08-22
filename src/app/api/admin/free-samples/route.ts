import { z } from "zod";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { ensureOfferingId } from "@/lib/offerings";

/**
 * Free-sample picker (design 2d): one sample test per offering
 * (Board + Class + Subject), stored in tq_free_tests.
 *
 * The row list is driven by the offerings that exist for this board+class —
 * a subject with no offering has no shelf to put a sample on.
 */
const putSchema = z.object({
  boardId: z.number().int().positive(),
  classId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  testId: z.number().int().positive().nullable(), // null clears
});

export async function GET(request: NextRequest) {
  try {
    await requireAuth("admin");
    const p = request.nextUrl.searchParams;
    const boardId = Number(p.get("boardId"));
    const classId = Number(p.get("classId"));
    if (!boardId || !classId) return error("boardId, classId required", 400);

    const offerings = await prisma.offering.findMany({
      where: { boardId, classId, isActive: true },
      include: {
        subject: { select: { id: true, name: true } },
        freeTest: { select: { testId: true } },
      },
      orderBy: { subject: { name: "asc" } },
    });

    const testIds = offerings.flatMap((o) => (o.freeTest ? [o.freeTest.testId] : []));
    const testNames = new Map<number, string>();
    if (testIds.length > 0) {
      const tests = await prisma.test.findMany({
        where: { id: { in: testIds } },
        select: { id: true, name: true },
      });
      for (const t of tests) testNames.set(t.id, t.name);
    }

    return success(offerings.map((o) => {
      const testId = o.freeTest?.testId ?? null;
      return {
        offeringId: o.id,
        subjectId: o.subject.id,
        subjectName: o.subject.name,
        testId,
        testName: testId ? testNames.get(testId) ?? `Test ${testId}` : null,
      };
    }));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(request: Request) {
  try {
    await requireAuth("admin");
    const body = await parseBody(request, putSchema);
    const offeringId = await ensureOfferingId(body.boardId, body.classId, body.subjectId);

    if (body.testId == null) {
      await prisma.freeTest.deleteMany({ where: { offeringId } });
      return success({ cleared: true });
    }

    // The sample must be an active test that belongs to this offering
    const test = await prisma.test.findFirst({
      where: { id: body.testId, offeringId, isActive: true },
      select: { id: true },
    });
    if (!test) return error("Pick an active test that belongs to this offering", 400);

    await prisma.freeTest.upsert({
      where: { offeringId },
      create: { offeringId, testId: body.testId },
      update: { testId: body.testId },
    });
    return success({ set: true });
  } catch (err) {
    return handleApiError(err);
  }
}
