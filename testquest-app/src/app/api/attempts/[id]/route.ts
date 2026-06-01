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

    const test = await getTest(status.testId);
    if (!test) return error("Test not found", 404);

    const allQuestions = await getTestQuestions(status.testId);
    const answers = await getAttemptAnswers(status.kind, status.token);
    const answerByQ = new Map(answers.map(a => [a.questionId, a]));

    // Map answers onto the question list. For SINGLE_MCQ/MULTI_MCQ, translate
    // 1-based positions back to option IDs (matching what the client picked).
    const questions = allQuestions.map((q, idx) => {
      const saved = answerByQ.get(q.id);
      let selectedOptionId: number | null = null;
      let fillAnswer: string | null = null;

      if (q.type === "FILL_IN_BLANK") {
        // Fill-in-blank: we store the raw text in user_answer; treat as text
        fillAnswer = saved?.userAnswerPositions.length === 0 ? null : "";
        // Hard to round-trip fill text via the position encoding. The
        // resolveAnswer call from /answer route handles it via fillAnswer.
      } else {
        // MCQ: convert first selected position to option id
        if (saved && saved.userAnswerPositions.length > 0) {
          const opts = q.options.sort((a, b) =>
            (a.label > b.label ? 1 : a.label < b.label ? -1 : 0));
          // position N → letter index N-1
          const firstPos = saved.userAnswerPositions[0];
          selectedOptionId = opts[firstPos - 1]?.id ?? null;
          // For multi-MCQ, we also pack selected IDs into fillAnswer (kept
          // for backward-compat with the take-test client's state shape).
          if (q.type === "MULTI_MCQ") {
            const ids = saved.userAnswerPositions
              .map(p => opts[p - 1]?.id)
              .filter((x): x is number => typeof x === "number");
            fillAnswer = ids.join(",");
          }
        }
      }

      return {
        index: idx + 1,
        id: q.id,
        type: q.type,
        text: q.text,
        marks: q.marks,
        options: q.options.map(o => ({ id: o.id, label: o.label, text: o.text })),
        selectedOptionId,
        fillAnswer,
        isFlagged: false, // legacy doesn't store flag state — frontend keeps it local
      };
    });

    // Time accounting
    const totalSeconds = test.durationMinutes * 60;
    let elapsed = 0;
    if (status.startedAt) {
      elapsed = Math.floor((Date.now() - +status.startedAt) / 1000);
    }
    const remainingSeconds = Math.max(0, totalSeconds - elapsed);

    return success({
      id: status.attemptId,
      status: status.status === 2 ? "COMPLETED" : "IN_PROGRESS",
      test: {
        id: test.id,
        name: test.name,
        durationMinutes: test.durationMinutes,
        isPractice: test.isPractice,
      },
      totalMarks: status.totalMarks,
      startedAt: status.startedAt,
      remainingSeconds: test.isPractice ? null : remainingSeconds,
      questions,
      answeredCount: answers.filter(a => a.userAnswerPositions.length > 0).length,
      flaggedCount: 0,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
