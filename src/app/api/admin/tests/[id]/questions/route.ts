import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { setTestQuestions } from "@/lib/legacy-admin";

type Params = { params: Promise<{ id: string }> };

const updateQuestionsSchema = z.object({
  questionIds: z.array(z.number().int().positive()).min(1),
});

export async function PUT(request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const testId = Number(id);
    const { questionIds } = await parseBody(request, updateQuestionsSchema);

    // Verify test exists (in vw_tests)
    const test = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM vw_tests WHERE id = ${testId} LIMIT 1
    `;
    if (!test[0]) return error("Test not found", 404);

    // Verify all questions exist
    const placeholders = questionIds.map(() => "?").join(",");
    const found = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
      `SELECT id FROM vw_questions WHERE id IN (${placeholders})`,
      ...questionIds
    );
    const foundSet = new Set(found.map(r => Number(r.id)));
    const missing = questionIds.filter(qid => !foundSet.has(qid));
    if (missing.length > 0) return error(`Questions not found: ${missing.join(", ")}`, 422);

    await setTestQuestions(testId, questionIds);
    return success({ ok: true, testId });
  } catch (err) {
    return handleApiError(err);
  }
}
