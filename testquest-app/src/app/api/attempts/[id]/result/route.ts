import { requireAuth } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import { resolveTestAccess } from "@/lib/access";
import { parseSelectedIds } from "@/lib/attempts";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/**
 * The review screen for a submitted attempt.
 *
 * Two variants, decided server-side. A student holding a pass sees full
 * solutions. A free-sample sitter sees their own answers and score, but the
 * correct options and the explanation **never leave the server** — the locked
 * payload carries flattened options and placeholder text, so no amount of
 * poking at the response reveals the answer key.
 *
 * The paper comes from the attempt's own pinned rows, so review shows exactly
 * the questions that were sat, in the order they were sat.
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await requireAuth("student");
    const { id } = await params;
    const attemptId = Number(id);
    if (!Number.isFinite(attemptId)) return error("Invalid attempt id", 400);

    const attempt = await prisma.attempt.findFirst({
      where: { id: attemptId, studentId: session.id },
      select: {
        id: true, testId: true, status: true, score: true, totalMarks: true,
        correctCount: true, wrongCount: true, unansweredCount: true,
        startedAt: true, finishedAt: true, timeSpentSeconds: true,
        test: {
          select: {
            id: true, name: true, durationMinutes: true, isPractice: true,
            offering: {
              select: {
                boardId: true, classId: true,
                subject: { select: { id: true, name: true } },
                class: { select: { id: true, name: true } },
              },
            },
          },
        },
        answers: {
          orderBy: { id: "asc" },
          select: {
            selectedOptionIds: true, isCorrect: true, marksAwarded: true,
            question: {
              select: {
                id: true, type: true, text: true, marks: true, explanation: true,
                chapter: { select: { id: true, name: true } },
                options: {
                  orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                  select: { id: true, label: true, text: true, isCorrect: true },
                },
              },
            },
          },
        },
      },
    });
    if (!attempt) return error("Attempt not found", 404);
    if (attempt.status !== "COMPLETED") return error("This attempt hasn't been submitted yet", 400);

    const { reason } = await resolveTestAccess(session.id, attempt.testId);
    const showSolutions = reason === "CLASS_PASS";

    const offering = attempt.test.offering;

    // Upsell scope for the locked variant's paywall CTA.
    let upsell: { boardId: number; classId: number; minPrice: number | null } | null = null;
    if (!showSolutions) {
      const plans = await prisma.b2cPlan.findMany({
        where: { boardId: offering.boardId, classId: offering.classId, subjectId: null, isActive: true },
        select: { price: true },
      });
      upsell = {
        boardId: offering.boardId,
        classId: offering.classId,
        minPrice: plans.length ? Math.min(...plans.map((p) => Number(p.price))) : null,
      };
    }

    const questionResults = attempt.answers.map((a, idx) => {
      const q = a.question;
      const selectedIds = parseSelectedIds(a.selectedOptionIds);
      const skipped = selectedIds.length === 0;

      const base = {
        index: idx + 1,
        id: q.id,
        type: q.type,
        text: q.text,
        marks: q.marks,
        chapter: q.chapter ?? { id: 0, name: "" },
        isCorrect: a.isCorrect === true,
        marksAwarded: a.marksAwarded,
        skipped,
        studentAnswer: {
          selectedOptionId: selectedIds[0] ?? null,
          selectedOptionIds: selectedIds,
          selectedOption: selectedIds[0]
            ? q.options.find((o) => o.id === selectedIds[0]) ?? null
            : null,
          fillAnswer: null as string | null,
        },
      };

      if (!showSolutions) {
        // Correctness flags stripped and the explanation replaced — the answer
        // key is the product, so it stays server-side.
        return {
          ...base,
          allOptions: q.options.map((o) => ({ id: o.id, label: o.label, text: o.text, isCorrect: false })),
          explanation:
            "Step-by-step solutions are included in the class pass. Unlock to see exactly where you went wrong and how to fix it.",
          solutionLocked: true,
        };
      }

      return {
        ...base,
        allOptions: q.options,
        explanation: q.explanation,
        correctAnswer: { options: q.options.filter((o) => o.isCorrect), correctText: null },
      };
    });

    const percentage = attempt.totalMarks > 0
      ? Number(((attempt.score / attempt.totalMarks) * 100).toFixed(2))
      : 0;

    return success({
      id: attempt.id,
      test: {
        id: attempt.test.id,
        name: attempt.test.name,
        durationMinutes: attempt.test.durationMinutes,
        totalMarks: attempt.totalMarks,
        isPractice: attempt.test.isPractice,
        subject: offering.subject,
        class: offering.class,
      },
      status: "COMPLETED",
      score: attempt.score,
      totalMarks: attempt.totalMarks,
      percentage,
      correctCount: attempt.correctCount,
      wrongCount: attempt.wrongCount,
      unansweredCount: attempt.unansweredCount,
      startedAt: attempt.startedAt,
      finishedAt: attempt.finishedAt,
      timeSpentSeconds: attempt.timeSpentSeconds,
      solutionsLocked: !showSolutions,
      upsell,
      questions: questionResults,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
