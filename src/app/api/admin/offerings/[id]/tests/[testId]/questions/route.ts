import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string; testId: string }> };

/**
 * The question set of one test.
 *
 * PUT replaces the whole set with the ordered list given. Every id is checked
 * against the offering's own bank first, so a test can never be assembled from
 * another shelf's content. `totalMarks` is recomputed here — it is derived
 * state and is never trusted from the client.
 */
const setSchema = z.object({
  questionIds: z.array(z.number().int().positive()).max(500),
});

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id, testId } = await params;
    const offeringId = Number(id);

    const test = await prisma.test.findFirst({
      where: { id: Number(testId), offeringId },
      select: { id: true },
    });
    if (!test) return error("Test not found in this offering", 404);

    const links = await prisma.testQuestion.findMany({
      where: { testId: test.id },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: {
        question: {
          select: {
            id: true, text: true, type: true, difficulty: true, marks: true,
            chapter: { select: { id: true, name: true } },
          },
        },
      },
    });

    return success({
      questionIds: links.map((l) => l.questionId),
      questions: links.map((l) => ({
        id: l.question.id,
        text: l.question.text,
        type: l.question.type,
        difficulty: l.question.difficulty,
        marks: l.question.marks,
        chapter: l.question.chapter,
      })),
      totalMarks: links.reduce((sum, l) => sum + l.question.marks, 0),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id, testId } = await params;
    const offeringId = Number(id);

    const test = await prisma.test.findFirst({
      where: { id: Number(testId), offeringId },
      select: { id: true },
    });
    if (!test) return error("Test not found in this offering", 404);

    const body = await parseBody(request, setSchema);
    const wanted = [...new Set(body.questionIds)];

    // Every question must be on this shelf — i.e. carry one of its chapters.
    let marksById = new Map<number, number>();
    if (wanted.length > 0) {
      const eligible = await prisma.question.findMany({
        where: { id: { in: wanted }, isActive: true, chapter: { offeringId } },
        select: { id: true, marks: true },
      });
      marksById = new Map(eligible.map((q) => [q.id, q.marks]));
      const rejected = wanted.filter((qid) => !marksById.has(qid));
      if (rejected.length > 0) {
        return error(
          `${rejected.length} question(s) are not in this offering's bank. Tag them to one of its chapters first.`,
          400,
        );
      }
    }

    const totalMarks = wanted.reduce((sum, qid) => sum + (marksById.get(qid) ?? 0), 0);

    await prisma.$transaction(async (tx) => {
      await tx.testQuestion.deleteMany({ where: { testId: test.id } });
      if (wanted.length > 0) {
        await tx.testQuestion.createMany({
          data: wanted.map((questionId, i) => ({ testId: test.id, questionId, sortOrder: i + 1 })),
        });
      }
      await tx.test.update({
        where: { id: test.id },
        data: {
          totalMarks,
          // An emptied test cannot stay live.
          ...(wanted.length === 0 ? { isActive: false } : {}),
        },
      });
    });

    return success({ count: wanted.length, totalMarks });
  } catch (err) {
    return handleApiError(err);
  }
}
