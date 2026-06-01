import { requireAuth } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import { getTest, getTestQuestions } from "@/lib/legacy-content";
import { getAttemptStatus, getAttemptAnswers } from "@/lib/legacy-attempts";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await requireAuth("student");
    const { id } = await params;
    const attemptId = Number(id);
    if (!Number.isFinite(attemptId)) return error("Invalid attempt id", 400);

    const status = await getAttemptStatus(attemptId);
    if (!status || status.studentId !== session.id) return error("Attempt not found", 404);
    if (status.status !== 2) return error("This attempt hasn't been submitted yet", 400);

    const test = await getTest(status.testId);
    if (!test) return error("Test not found", 404);

    const allQuestions = await getTestQuestions(status.testId);
    const answers = await getAttemptAnswers(status.kind, status.token);
    const answerByQ = new Map(answers.map(a => [a.questionId, a]));

    // Free tests show score only; paid show full solutions
    const showSolutions = !test.isFree;

    let correct = 0, incorrect = 0, skipped = 0;
    const questionResults = allQuestions.map((q, idx) => {
      const a = answerByQ.get(q.id);
      const optsSorted = q.options.sort((x, y) =>
        x.label > y.label ? 1 : x.label < y.label ? -1 : 0);

      const userPositions = a?.userAnswerPositions ?? [];
      const userOptionIds = userPositions.map(p => optsSorted[p - 1]?.id).filter((x): x is number => typeof x === "number");
      const isAnswered = userPositions.length > 0;
      const isCorrect = (a?.result ?? 0) === 1;
      const marksAwarded = isCorrect ? (a?.marks ?? 0) : 0;
      if (!isAnswered) skipped++;
      else if (isCorrect) correct++;
      else incorrect++;

      const base = {
        index: idx + 1,
        id: q.id,
        type: q.type,
        text: q.text,
        marks: q.marks,
        chapter: { id: 0, name: "" },
        isCorrect,
        marksAwarded,
        skipped: !isAnswered,
        studentAnswer: {
          selectedOptionId: userOptionIds[0] ?? null,
          selectedOption: userOptionIds[0] ? optsSorted.find(o => o.id === userOptionIds[0]) ?? null : null,
          fillAnswer: null as string | null,
        },
      };

      if (!showSolutions) return base;

      return {
        ...base,
        explanation: q.explanation,
        allOptions: optsSorted,
        correctAnswer: {
          options: optsSorted.filter(o => o.isCorrect),
          correctText: null,
        },
      };
    });

    const percentage = status.totalMarks > 0
      ? Number(((status.userScore / status.totalMarks) * 100).toFixed(2))
      : 0;

    return success({
      id: status.attemptId,
      test: {
        id: test.id,
        name: test.name,
        durationMinutes: test.durationMinutes,
        totalMarks: status.totalMarks,
        isFree: test.isFree,
        isPractice: test.isPractice,
        subject: test.subjectId ? { id: test.subjectId, name: test.subjectName } : { id: 0, name: "" },
        class: test.classId ? { id: test.classId, name: test.className } : { id: 0, name: "" },
      },
      status: "LEGACY_COMPLETED",
      score: status.userScore,
      totalMarks: status.totalMarks,
      percentage,
      timeSpentSeconds: status.timeSpentSeconds,
      startedAt: status.startedAt,
      finishedAt: status.finishedAt,
      summary: { total: allQuestions.length, correct, incorrect, skipped },
      showSolutions,
      questions: questionResults,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
