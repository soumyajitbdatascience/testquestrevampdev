/**
 * The attempt engine, on `tq_attempts` / `tq_attempt_answers`.
 *
 * Replaces the legacy engine that wrote `main_exam_status` / `main_exam_result`
 * — tables that do not exist in this database. The HTTP contract is unchanged:
 * the routes, their payloads and the client's answer shape (option **ids**) are
 * exactly as before. What is gone is the legacy *storage* translation, which
 * converted ids to a position CSV (`",,3,,,"`); `selectedOptionIds` holds a
 * native JSON id array instead.
 *
 * ── The paper is pinned at start ────────────────────────────────────────────
 * One `AttemptAnswer` row per question is written when the attempt begins, in
 * the order the student will see. That row set *is* the paper:
 *
 *   · **Order** — rows are replayed by `id ASC`, i.e. insertion order, so a
 *     resume shows the same questions in the same sequence, forever.
 *   · **Set** — an admin adding, removing or reordering a test's questions
 *     mid-attempt cannot change the paper under someone already sitting it.
 *   · **Scoring** — `scoreAttempt` walks these rows, not the test's current
 *     questions, so the score always matches the paper that was sat.
 *
 * Questions are shuffled once at start (options are never shuffled — 189
 * questions have options that reference each other, e.g. "both A and B").
 * Shuffling happens *before* insertion, so randomness and stable resume are
 * not in tension: the order is random per attempt, then frozen.
 *
 * A pre-created row means "asked", not "answered" — answered is
 * `selectedOptionIds` being a non-empty array.
 *
 * ── Time ───────────────────────────────────────────────────────────────────
 * There is no `pausedAt` column, so `startedAt` carries the clock: pause banks
 * the elapsed seconds into `timeSpentSeconds`, and resume shifts `startedAt`
 * forward by the time spent paused. Elapsed is therefore always
 * `now - startedAt`, and paused time never counts against the student.
 */
import { prisma } from "@/lib/db";
import { scoreAttempt } from "@/lib/scoring";

export interface AttemptSummary {
  attemptId: number;
  testId: number;
  testName: string;
  durationMinutes: number;
  isPractice: boolean;
  totalMarks: number;
  startedAt: Date;
  /** Question ids in this attempt's pinned order. */
  questionIds: number[];
}

/** Fisher–Yates. Order is decided once, here, and then frozen by insertion. */
function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function elapsedSeconds(startedAt: Date): number {
  return Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));
}

/** Seconds left on the clock, or null for an untimed (practice) test. */
export function remainingSeconds(startedAt: Date, durationMinutes: number, isPractice: boolean): number | null {
  if (isPractice || durationMinutes <= 0) return null;
  return Math.max(0, durationMinutes * 60 - elapsedSeconds(startedAt));
}

/**
 * Starts an attempt: pins the paper, banks the total marks, returns the order.
 *
 * `totalMarks` is snapshotted on the attempt row because the questions' marks
 * can be edited later, and a percentage must always divide by the total that
 * was actually on offer.
 */
export async function startAttempt(studentId: number, testId: number): Promise<AttemptSummary> {
  const test = await prisma.test.findFirst({
    where: { id: testId, isActive: true },
    select: {
      id: true, name: true, durationMinutes: true, isPractice: true,
      questions: {
        orderBy: [{ sortOrder: "asc" }, { questionId: "asc" }],
        select: { questionId: true, question: { select: { marks: true, isActive: true } } },
      },
    },
  });
  if (!test) throw new Error("Test not found");

  const askable = test.questions.filter((q) => q.question.isActive);
  if (askable.length === 0) throw new Error("This test has no questions yet");

  const totalMarks = askable.reduce((n, q) => n + q.question.marks, 0);
  const order = shuffled(askable.map((q) => q.questionId));

  const attempt = await prisma.attempt.create({
    data: { studentId, testId: test.id, totalMarks, unansweredCount: order.length },
    select: { id: true, startedAt: true },
  });

  // One statement, so the rows take sequential ids in exactly this order —
  // which is what makes insertion order a durable record of the paper.
  await prisma.attemptAnswer.createMany({
    data: order.map((questionId) => ({ attemptId: attempt.id, questionId })),
  });

  return {
    attemptId: attempt.id,
    testId: test.id,
    testName: test.name,
    durationMinutes: test.durationMinutes,
    isPractice: test.isPractice,
    totalMarks,
    startedAt: attempt.startedAt,
    questionIds: order,
  };
}

/** An in-progress attempt for this student on this test, if one exists. */
export async function findActiveAttempt(studentId: number, testId: number) {
  return prisma.attempt.findFirst({
    where: { studentId, testId, status: "IN_PROGRESS" },
    orderBy: { startedAt: "desc" },
    select: { id: true, totalMarks: true, startedAt: true, timeSpentSeconds: true },
  });
}

export interface AttemptQuestion {
  index: number;
  id: number;
  type: string;
  text: string;
  marks: number;
  options: Array<{ id: number; label: string; text: string }>;
  selectedOptionId: number | null;
  selectedOptionIds: number[];
  fillAnswer: string | null;
  isFlagged: boolean;
}

export function parseSelectedIds(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : [];
  } catch {
    // A malformed blob is treated as unanswered rather than crashing a paper
    // the student is part-way through.
    return [];
  }
}

/**
 * The whole attempt for the player: the pinned paper in its pinned order, with
 * whatever has been answered so far.
 */
export async function getAttempt(attemptId: number, studentId: number) {
  const attempt = await prisma.attempt.findFirst({
    where: { id: attemptId, studentId },
    select: {
      id: true, testId: true, status: true, totalMarks: true, startedAt: true,
      finishedAt: true, timeSpentSeconds: true, score: true,
      test: { select: { id: true, name: true, durationMinutes: true, isPractice: true } },
      answers: {
        // Insertion order — the paper as it was dealt.
        orderBy: { id: "asc" },
        select: {
          questionId: true, selectedOptionIds: true,
          question: {
            select: {
              id: true, type: true, text: true, marks: true,
              options: {
                orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                select: { id: true, label: true, text: true },
              },
            },
          },
        },
      },
    },
  });
  if (!attempt) return null;

  const questions: AttemptQuestion[] = attempt.answers.map((a, i) => {
    const ids = parseSelectedIds(a.selectedOptionIds);
    return {
      index: i + 1,
      id: a.question.id,
      type: a.question.type,
      text: a.question.text,
      marks: a.question.marks,
      options: a.question.options,
      // Kept for the single-choice client contract.
      selectedOptionId: ids.length === 1 ? ids[0] : null,
      selectedOptionIds: ids,
      fillAnswer: null,
      isFlagged: false, // flags stay client-side; there is no column for them
    };
  });

  return { attempt, questions, answeredCount: questions.filter((q) => q.selectedOptionIds.length > 0).length };
}

/**
 * Records an answer.
 *
 * The question must already be part of this attempt's paper — an update that
 * matches no pinned row is refused, so nobody can answer a question they were
 * never asked (or one slipped into the test mid-attempt).
 */
export async function saveAnswer(opts: {
  attemptId: number;
  questionId: number;
  selectedOptionIds: number[];
}): Promise<boolean> {
  const ids = [...new Set(opts.selectedOptionIds)].filter((n) => Number.isInteger(n) && n > 0);

  // Only options that genuinely belong to this question may be stored, so a
  // crafted request cannot smuggle in another question's correct option id.
  const valid = ids.length === 0 ? [] : (await prisma.questionOption.findMany({
    where: { questionId: opts.questionId, id: { in: ids } },
    select: { id: true },
  })).map((o) => o.id);

  const { count } = await prisma.attemptAnswer.updateMany({
    where: { attemptId: opts.attemptId, questionId: opts.questionId },
    data: { selectedOptionIds: valid.length > 0 ? JSON.stringify(valid) : null, answeredAt: new Date() },
  });
  return count > 0;
}

/** Banks elapsed time; the attempt stays in progress. */
export async function pauseAttempt(attemptId: number): Promise<void> {
  const a = await prisma.attempt.findUnique({ where: { id: attemptId }, select: { startedAt: true, status: true } });
  if (!a || a.status !== "IN_PROGRESS") return;
  await prisma.attempt.update({
    where: { id: attemptId },
    data: { timeSpentSeconds: elapsedSeconds(a.startedAt) },
  });
}

/**
 * Restarts the clock where it stopped: `startedAt` moves forward so that
 * `now - startedAt` equals the time actually spent working.
 */
export async function resumeAttempt(attemptId: number): Promise<void> {
  const a = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: { timeSpentSeconds: true, status: true },
  });
  if (!a || a.status !== "IN_PROGRESS") return;
  await prisma.attempt.update({
    where: { id: attemptId },
    data: { startedAt: new Date(Date.now() - a.timeSpentSeconds * 1000) },
  });
}

/** Marks the attempt finished and scores it. Idempotent. */
export async function submitAttempt(attemptId: number) {
  const a = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: { status: true, startedAt: true },
  });
  if (!a) throw new Error("Attempt not found");
  if (a.status === "COMPLETED") return scoreAttempt(attemptId);

  await prisma.attempt.update({
    where: { id: attemptId },
    data: {
      status: "COMPLETED",
      finishedAt: new Date(),
      timeSpentSeconds: elapsedSeconds(a.startedAt),
    },
  });
  return scoreAttempt(attemptId);
}
