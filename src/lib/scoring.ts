import { prisma } from "./db";

/**
 * Scores a submitted attempt against `tq_attempts` / `tq_attempt_answers`.
 *
 * Answers store `selectedOptionIds` as a JSON array of `tq_question_options.id`
 * (MariaDB keeps JSON in LONGTEXT), which covers single- and multi-select with
 * one shape. Multi-select is **all-or-nothing**: every correct option and no
 * wrong ones. No partial credit — a half-right answer to "select all that
 * apply" is not a right answer.
 *
 * Scoring walks the attempt's own answer rows, which were pinned when the
 * attempt started — *not* the test's current question list. If it read the
 * test, an admin editing questions mid-attempt would score a student against a
 * paper they never saw.
 *
 * Questions with no options (FILL_IN_BLANK / SUBJECTIVE) cannot be judged here
 * and score zero; `correctText` comparison would belong to the caller.
 */
function parseSelectedIds(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}

export async function scoreAttempt(attemptId: number) {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      totalMarks: true,
      answers: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          selectedOptionIds: true,
          question: {
            select: { id: true, marks: true, options: { select: { id: true, isCorrect: true } } },
          },
        },
      },
    },
  });

  if (!attempt) throw new Error("Attempt not found");

  let totalScore = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;

  const writes: Array<{ id: number; isCorrect: boolean; marksAwarded: number }> = [];

  for (const answer of attempt.answers) {
    const question = answer.question;
    const selectedIds = parseSelectedIds(answer.selectedOptionIds);

    if (selectedIds.length === 0) {
      unansweredCount++;
      // An unanswered question is not wrong — it carries no verdict at all.
      writes.push({ id: answer.id, isCorrect: false, marksAwarded: 0 });
      continue;
    }

    const correctIds = question.options.filter((o) => o.isCorrect).map((o) => o.id).sort((a, z) => a - z);
    // Deduped and sorted, so [c,a] and [a,a,c] judge the same as [a,c].
    const chosenIds = [...new Set(selectedIds)].sort((a, z) => a - z);

    const isCorrect =
      correctIds.length > 0 &&
      correctIds.length === chosenIds.length &&
      correctIds.every((id, i) => id === chosenIds[i]);

    const marks = isCorrect ? question.marks : 0;
    if (isCorrect) correctCount++;
    else wrongCount++;

    writes.push({ id: answer.id, isCorrect, marksAwarded: marks });
    totalScore += marks;
  }

  // One transaction rather than a round trip per question: a 151-question
  // paper would otherwise be 151 sequential statements against a shared host.
  await prisma.$transaction([
    ...writes.map((w) =>
      prisma.attemptAnswer.update({
        where: { id: w.id },
        data: { isCorrect: w.isCorrect, marksAwarded: w.marksAwarded },
      }),
    ),
    prisma.attempt.update({
      where: { id: attemptId },
      data: { score: totalScore, correctCount, wrongCount, unansweredCount },
    }),
  ]);

  const percentage =
    attempt.totalMarks > 0
      ? Number(((totalScore / attempt.totalMarks) * 100).toFixed(2))
      : 0;

  return { score: totalScore, totalMarks: attempt.totalMarks, percentage, correctCount, wrongCount, unansweredCount };
}
