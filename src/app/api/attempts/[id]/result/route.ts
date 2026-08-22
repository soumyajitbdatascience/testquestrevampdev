import { requireAuth } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import { hasClassAccess, resolveTestAccess } from "@/lib/access";
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

/**
 * The success payload, exported so the page can import it instead of
 * re-declaring the shape by hand.
 *
 * `fetch(...).then(r => r.json())` is `any`, so a page-local `interface` is
 * decorative — it documents an intention the compiler never checks. That is how
 * `summary` and `showSolutions` went missing from this route while `tsc` and
 * `next build` both stayed green all the way to a paying student. Importing
 * this type makes the next drift a build failure instead of a white screen.
 *
 * Kept hand-written rather than inferred from the handler: `success()` erases
 * the shape into `NextResponse`, and a type that has to be *stated* is one a
 * reviewer can read next to the JSX.
 */
export interface AttemptResultOption {
  id: number;
  label: string;
  text: string;
  /** Always false in the locked variant — the key stays server-side. */
  isCorrect: boolean;
}

export interface AttemptResultQuestion {
  index: number;
  id: number;
  type: string;
  text: string;
  marks: number;
  chapter: { id: number; name: string };
  isCorrect: boolean;
  marksAwarded: number;
  skipped: boolean;
  studentAnswer: {
    selectedOptionId: number | null;
    selectedOptionIds: number[];
    selectedOption: AttemptResultOption | null;
    fillAnswer: string | null;
  };
  allOptions: AttemptResultOption[];
  explanation: string | null;
  /** Present only on the locked variant. */
  solutionLocked?: true;
  /** Present only when solutions are shown. */
  correctAnswer?: { options: AttemptResultOption[]; correctText: string | null };
}

export interface AttemptResultResponse {
  id: number;
  test: {
    id: number;
    name: string;
    durationMinutes: number;
    totalMarks: number;
    isPractice: boolean;
    subject: { id: number; name: string };
    class: { id: number; name: string };
  };
  status: string;
  score: number;
  totalMarks: number;
  percentage: number | string;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  summary: { total: number; correct: number; incorrect: number; skipped: number };
  /** True when the student may see the answer key and explanations. */
  showSolutions: boolean;
  startedAt: string | Date;
  finishedAt: string | Date | null;
  timeSpentSeconds: number;
  solutionsLocked: boolean;
  upsell: { boardId: number; classId: number; minPrice: number | null } | null;
  questions: AttemptResultQuestion[];
}

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

    const offering = attempt.test.offering;

    /**
     * Who may see the answer key.
     *
     * This used to be `reason === "CLASS_PASS"` alone, which quietly charged
     * pass holders for solutions they had already bought.
     * `resolveAccessForTests` checks free samples *before* passes, so a sample
     * always resolves `FREE_SAMPLE` — correct for **access**, since a sample is
     * public and the cheapest true answer wins — but it means the reason says
     * nothing about whether this particular student also holds the class. A
     * Class 7 pass holder reviewing the Biology sample got the locked variant:
     * blurred explanations and an upsell for the pass in their account.
     *
     * So access precedence is left exactly as it is, and this derivation asks
     * the question it actually cares about: does this student hold the class?
     * One extra indexed lookup on a page that already runs several, and only
     * when the cheap check has not already said yes.
     */
    const { reason } = await resolveTestAccess(session.id, attempt.testId);
    const showSolutions =
      reason === "CLASS_PASS" ||
      (await hasClassAccess(session.id, offering.boardId, offering.classId));

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
      /**
       * The same three counters, in the shape the result page reads.
       *
       * The page has always declared `summary` and `showSolutions`; this route
       * has always sent flat `correctCount` / `wrongCount` / `solutionsLocked`.
       * The fetch is untyped, so nothing caught the mismatch and every read of
       * `result.summary.*` threw on a real score screen. Both spellings ship
       * now — the flat ones stay for any consumer already on them.
       *
       * `total` comes from `answers.length` rather than the counters: the rows
       * are the paper as it was actually sat, one per question, so they are the
       * denominator a student is being scored against. If a stored counter ever
       * drifts from that (a partial re-score), the tiles would stop summing to
       * the total — which is the visible symptom you want, not a silently
       * reconciled number.
       */
      summary: {
        total: attempt.answers.length,
        correct: attempt.correctCount,
        incorrect: attempt.wrongCount,
        skipped: attempt.unansweredCount,
      },
      showSolutions,
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
