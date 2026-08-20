import { beforeEach, describe, expect, it } from "vitest";
import { prismaMock } from "@/test/prisma-mock";
import { saveAnswer } from "@/lib/attempts";
import { scoreAttempt } from "@/lib/scoring";

/**
 * Answer round-trip: what the client sends → what is stored → what it scores.
 *
 * Multi-select is the case worth guarding hardest. There are exactly **4**
 * MULTI_MCQ questions in the whole bank against 5,469 single-choice ones, so
 * production traffic will almost never exercise it — these tests are the only
 * real coverage the rule has.
 *
 * The rule: all-or-nothing. Every correct option, no wrong ones, no partial
 * credit. Order and duplicates in the request must not change the verdict.
 */

// Q1: options 41–44, correct = {41, 43}. Q2: single-choice, correct = 52.
const MULTI = {
  id: 1,
  marks: 2,
  options: [
    { id: 41, isCorrect: true },
    { id: 42, isCorrect: false },
    { id: 43, isCorrect: true },
    { id: 44, isCorrect: false },
  ],
};
const SINGLE = {
  id: 2,
  marks: 1,
  options: [
    { id: 51, isCorrect: false },
    { id: 52, isCorrect: true },
  ],
};

/** An attempt whose pinned rows carry exactly these stored selections. */
function stubAttempt(rows: Array<{ id: number; question: typeof MULTI; selectedOptionIds: string | null }>) {
  prismaMock.attempt.findUnique.mockResolvedValue({
    id: 900,
    totalMarks: rows.reduce((n, r) => n + r.question.marks, 0),
    answers: rows,
  } as never);
  prismaMock.$transaction.mockResolvedValue([] as never);
}

/** What `saveAnswer` actually persisted, as the raw column value. */
function storedValue(): string | null {
  const data = prismaMock.attemptAnswer.updateMany.mock.calls[0][0].data as Record<string, unknown>;
  return data.selectedOptionIds as string | null;
}

/** The verdict written for a given answer-row id. */
function verdictFor(rowId: number) {
  const call = prismaMock.attemptAnswer.update.mock.calls.find((c) => c[0].where?.id === rowId);
  return call?.[0].data as { isCorrect: boolean; marksAwarded: number } | undefined;
}

beforeEach(() => {
  // Every option id used below is a real option of the question being answered.
  prismaMock.questionOption.findMany.mockImplementation((async (args: {
    where: { questionId: number; id: { in: number[] } };
  }) => {
    const owner = args.where.questionId === MULTI.id ? MULTI : SINGLE;
    return owner.options.filter((o) => args.where.id.in.includes(o.id)).map((o) => ({ id: o.id }));
  }) as never);
  prismaMock.attemptAnswer.updateMany.mockResolvedValue({ count: 1 } as never);
});

describe("saveAnswer — what reaches the column", () => {
  it("stores a native JSON array of option ids, not a position CSV", async () => {
    await saveAnswer({ attemptId: 900, questionId: 1, selectedOptionIds: [41, 43] });

    // The legacy engine wrote ",,3,,," here. The new column holds ids.
    expect(storedValue()).toBe("[41,43]");
    expect(JSON.parse(storedValue()!)).toEqual([41, 43]);
  });

  it("clears the answer to null when nothing is selected", async () => {
    await saveAnswer({ attemptId: 900, questionId: 1, selectedOptionIds: [] });

    expect(storedValue()).toBeNull();
  });

  it("drops option ids that belong to a different question", async () => {
    // Otherwise a crafted request could smuggle in another question's key.
    await saveAnswer({ attemptId: 900, questionId: 1, selectedOptionIds: [41, 52, 999] });

    expect(JSON.parse(storedValue()!)).toEqual([41]);
  });

  it("refuses a question that isn't on this attempt's paper", async () => {
    prismaMock.attemptAnswer.updateMany.mockResolvedValue({ count: 0 } as never);

    expect(await saveAnswer({ attemptId: 900, questionId: 1, selectedOptionIds: [41] })).toBe(false);
  });
});

describe("multi-select round trip — save then score", () => {
  it("the exact correct set scores full marks", async () => {
    await saveAnswer({ attemptId: 900, questionId: 1, selectedOptionIds: [41, 43] });
    stubAttempt([{ id: 10, question: MULTI, selectedOptionIds: storedValue() }]);

    const result = await scoreAttempt(900);

    expect(verdictFor(10)).toEqual({ isCorrect: true, marksAwarded: 2 });
    expect(result).toMatchObject({ score: 2, correctCount: 1, wrongCount: 0, unansweredCount: 0 });
  });

  it("selection order doesn't change the verdict", async () => {
    await saveAnswer({ attemptId: 900, questionId: 1, selectedOptionIds: [43, 41] });
    stubAttempt([{ id: 10, question: MULTI, selectedOptionIds: storedValue() }]);

    await scoreAttempt(900);

    expect(verdictFor(10)?.isCorrect).toBe(true);
  });

  it("a duplicated click still scores correct", async () => {
    await saveAnswer({ attemptId: 900, questionId: 1, selectedOptionIds: [41, 41, 43] });
    stubAttempt([{ id: 10, question: MULTI, selectedOptionIds: storedValue() }]);

    await scoreAttempt(900);

    expect(JSON.parse(storedValue()!)).toEqual([41, 43]);
    expect(verdictFor(10)?.isCorrect).toBe(true);
  });

  it("a subset earns nothing — no partial credit", async () => {
    await saveAnswer({ attemptId: 900, questionId: 1, selectedOptionIds: [41] });
    stubAttempt([{ id: 10, question: MULTI, selectedOptionIds: storedValue() }]);

    const result = await scoreAttempt(900);

    expect(verdictFor(10)).toEqual({ isCorrect: false, marksAwarded: 0 });
    expect(result).toMatchObject({ score: 0, correctCount: 0, wrongCount: 1 });
  });

  it("a superset is wrong — picking everything must not win", async () => {
    await saveAnswer({ attemptId: 900, questionId: 1, selectedOptionIds: [41, 42, 43, 44] });
    stubAttempt([{ id: 10, question: MULTI, selectedOptionIds: storedValue() }]);

    const result = await scoreAttempt(900);

    expect(verdictFor(10)?.isCorrect).toBe(false);
    expect(result.score).toBe(0);
  });

  it("the right count but the wrong options is wrong", async () => {
    await saveAnswer({ attemptId: 900, questionId: 1, selectedOptionIds: [42, 44] });
    stubAttempt([{ id: 10, question: MULTI, selectedOptionIds: storedValue() }]);

    expect((await scoreAttempt(900)).correctCount).toBe(0);
  });

  it("an untouched question counts unanswered, not wrong", async () => {
    stubAttempt([{ id: 10, question: MULTI, selectedOptionIds: null }]);

    const result = await scoreAttempt(900);

    expect(result).toMatchObject({ unansweredCount: 1, wrongCount: 0, correctCount: 0, score: 0 });
  });
});

describe("mixed paper", () => {
  it("scores single- and multi-select questions independently", async () => {
    await saveAnswer({ attemptId: 900, questionId: 1, selectedOptionIds: [41, 43] });
    const multiStored = storedValue();
    prismaMock.attemptAnswer.updateMany.mockClear();
    await saveAnswer({ attemptId: 900, questionId: 2, selectedOptionIds: [51] });
    const singleStored = storedValue();

    stubAttempt([
      { id: 10, question: MULTI, selectedOptionIds: multiStored },
      { id: 11, question: SINGLE as unknown as typeof MULTI, selectedOptionIds: singleStored },
    ]);

    const result = await scoreAttempt(900);

    expect(verdictFor(10)).toEqual({ isCorrect: true, marksAwarded: 2 });
    expect(verdictFor(11)).toEqual({ isCorrect: false, marksAwarded: 0 });
    expect(result).toMatchObject({ score: 2, totalMarks: 3, correctCount: 1, wrongCount: 1 });
    expect(result.percentage).toBeCloseTo(66.67, 1);
  });

  it("writes every verdict and the roll-up in one transaction", async () => {
    stubAttempt([
      { id: 10, question: MULTI, selectedOptionIds: "[41,43]" },
      { id: 11, question: SINGLE as unknown as typeof MULTI, selectedOptionIds: "[52]" },
    ]);

    await scoreAttempt(900);

    // 2 answer verdicts + 1 attempt roll-up, not 3 round trips.
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.$transaction.mock.calls[0][0]).toHaveLength(3);
  });

  it("survives a malformed stored value instead of failing the paper", async () => {
    stubAttempt([{ id: 10, question: MULTI, selectedOptionIds: "not json" }]);

    const result = await scoreAttempt(900);

    expect(result.unansweredCount).toBe(1);
  });
});

describe("scoring reads the pinned paper", () => {
  it("never consults the test's current question list", async () => {
    // An admin editing the test mid-attempt must not change what is scored.
    stubAttempt([{ id: 10, question: MULTI, selectedOptionIds: "[41,43]" }]);

    await scoreAttempt(900);

    const select = prismaMock.attempt.findUnique.mock.calls[0][0].select as Record<string, unknown>;
    expect(select.answers).toBeDefined();
    expect(select.test).toBeUndefined();
    expect(prismaMock.testQuestion.findMany).not.toHaveBeenCalled();
  });

  it("scores against the marks banked at start, not today's total", async () => {
    stubAttempt([{ id: 10, question: MULTI, selectedOptionIds: "[41,43]" }]);
    prismaMock.attempt.findUnique.mockResolvedValue({
      id: 900,
      totalMarks: 10, // banked when the attempt began
      answers: [{ id: 10, question: MULTI, selectedOptionIds: "[41,43]" }],
    } as never);

    expect((await scoreAttempt(900)).percentage).toBe(20);
  });
});
