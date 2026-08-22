import { describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/prisma-mock";
import { bareRequest, readJson, routeCtx } from "@/test/http";
import type { AttemptResultResponse } from "@/app/api/attempts/[id]/result/route";

/**
 * The attempt result payload — the contract the review screen renders from.
 *
 * This file exists because that contract drifted silently: the page read
 * `result.summary.correct`, the route sent a flat `correctCount`, and because
 * `r.json()` is `any` neither `tsc` nor `next build` noticed. A paying student
 * found it instead. These tests assert the shape the page actually consumes,
 * so the next divergence fails here rather than on a score screen.
 */

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    requireAuth: vi.fn(async () => ({ id: 17, email: "student@testquest.test", role: "student" as const })),
  };
});

/** `resolveTestAccess` is the gate this route reads; each test states its verdict. */
vi.mock("@/lib/access", async () => {
  const actual = await vi.importActual<typeof import("@/lib/access")>("@/lib/access");
  return {
    ...actual,
    resolveTestAccess: vi.fn(async () => ({ access: true, reason: "FREE_SAMPLE" as const })),
  };
});

const OFFERING = {
  boardId: 1,
  classId: 2,
  subject: { id: 5, name: "Biology" },
  class: { id: 2, name: "Class 7" },
};

/** One answered question, so `answers.length` is a real denominator. */
function answerRow(isCorrect: boolean | null) {
  return {
    selectedOptionIds: "1",
    isCorrect,
    marksAwarded: isCorrect ? 1 : 0,
    question: {
      id: 100, type: "SINGLE_MCQ", text: "Q?", marks: 1, explanation: "because",
      chapter: { id: 6, name: "General" },
      options: [
        { id: 1, label: "A", text: "a", isCorrect: true },
        { id: 2, label: "B", text: "b", isCorrect: false },
      ],
    },
  };
}

/**
 * An attempt whose counters and answer rows agree — 1 correct, 1 wrong,
 * 1 skipped across three questions.
 */
function stubAttempt() {
  prismaMock.attempt.findFirst.mockResolvedValue({
    id: 4, testId: 19, status: "COMPLETED",
    score: 1, totalMarks: 3,
    correctCount: 1, wrongCount: 1, unansweredCount: 1,
    startedAt: new Date("2026-08-21T10:00:00Z"),
    finishedAt: new Date("2026-08-21T10:30:00Z"),
    timeSpentSeconds: 1800,
    test: {
      id: 19, name: "Class 7-BIOLOGY Free", durationMinutes: 90, isPractice: false,
      offering: OFFERING,
    },
    answers: [answerRow(true), answerRow(false), answerRow(null)],
  } as never);
  prismaMock.b2cPlan.findMany.mockResolvedValue([{ price: 1000 }] as never);
}

/**
 * Reads the response through the route's own exported type rather than
 * re-describing it here. `readJson` hands back `unknown` by design, and the
 * whole point of exporting the contract is that both the page and this test
 * bind to one declaration — a field renamed in the route breaks both compiles.
 */
async function getResult() {
  const { GET } = await import("@/app/api/attempts/[id]/result/route");
  const res = await readJson(await GET(bareRequest("/api/attempts/4/result"), routeCtx({ id: "4" })));
  return { ...res, data: res.data as AttemptResultResponse };
}

describe("attempt result payload — the summary the page renders", () => {
  it("includes a summary in the shape the page reads", async () => {
    stubAttempt();

    const res = await getResult();

    expect(res.status).toBe(200);
    expect(res.data.summary).toEqual({ total: 3, correct: 1, incorrect: 1, skipped: 1 });
  });

  it("summary parts sum to total", async () => {
    stubAttempt();

    const { summary } = (await getResult()).data;

    // The three tiles are a partition of the paper. If this ever fails the
    // tiles no longer add up to the denominator shown beside them.
    expect(summary.correct + summary.incorrect + summary.skipped).toBe(summary.total);
  });

  it("keeps the flat counters alongside it, so the change is additive", async () => {
    stubAttempt();

    const d = (await getResult()).data;

    expect(d.correctCount).toBe(1);
    expect(d.wrongCount).toBe(1);
    expect(d.unansweredCount).toBe(1);
  });

  it("sends showSolutions, and solutionsLocked stays its inverse", async () => {
    stubAttempt();

    const d = (await getResult()).data;

    expect(typeof d.showSolutions).toBe("boolean");
    expect(d.solutionsLocked).toBe(!d.showSolutions);
  });

  it("refuses an attempt that was never submitted", async () => {
    stubAttempt();
    prismaMock.attempt.findFirst.mockResolvedValue({
      id: 4, status: "IN_PROGRESS",
    } as never);

    const res = await getResult();

    expect(res.status).toBe(400);
    expect(res.error).toMatch(/hasn't been submitted/i);
  });
});
