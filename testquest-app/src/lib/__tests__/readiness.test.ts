import { describe, expect, it } from "vitest";
import { computeReadiness, computeReadinessRow, READINESS_CHECKS } from "@/lib/readiness";
import {
  BOARD, CLASS_10, SUBJECT_MATHS, SUBJECT_SCIENCE,
  completeOffering, fullPlans, inactivePlans, readinessInput, unpricedOffering,
} from "@/test/factories";

/**
 * §3.2.C — launch-readiness computation.
 *
 * The home page's whole job is to answer "what's left?", so each test knocks
 * out exactly one gate and asserts three things: the rolled-up status, which
 * check failed, and where its deep link points. Getting the link wrong is as
 * bad as getting the status wrong — it sends someone to a screen that can't
 * fix the problem.
 */
describe("computeReadinessRow", () => {
  it("marks a fully-populated, priced offering as READY", () => {
    const row = computeReadinessRow(completeOffering(), fullPlans());

    expect(row.status).toBe("READY");
    expect(row.done).toBe(5);
    expect(row.total).toBe(5);
    expect(row.failing).toEqual([]);
    expect(READINESS_CHECKS.every((k) => row.checks[k].done)).toBe(true);
  });

  it("everything but price → IN_PROGRESS, failing check is 'plans', link goes to the pricing grid", () => {
    const row = computeReadinessRow(completeOffering(), []);

    expect(row.status).toBe("IN_PROGRESS");
    expect(row.done).toBe(4);
    expect(row.failing).toEqual(["plans"]);
    expect(row.checks.plans.done).toBe(false);
    // Pricing is commerce, not workspace content — the link must leave the
    // offering rather than open a tab that cannot set a price, and it must name
    // the row to price so the grid can put it in front of the user.
    expect(row.checks.plans.tab).toBeNull();
    expect(row.checks.plans.href).toBe(`/admin/plans?boardId=${BOARD.id}&classId=${CLASS_10.id}`);
  });

  it("no chapters → failing check is 'chapters', link opens the Chapters tab", () => {
    const row = computeReadinessRow(completeOffering({ chapterCount: 0 }), fullPlans());

    expect(row.status).toBe("IN_PROGRESS");
    expect(row.failing).toEqual(["chapters"]);
    expect(row.checks.chapters.tab).toBe("chapters");
    expect(row.checks.chapters.href).toBe("/admin/offerings/25?tab=chapters");
  });

  it("no questions tagged → failing check is 'questions', link opens the Questions tab", () => {
    const row = computeReadinessRow(completeOffering({ questionCount: 0 }), fullPlans());

    expect(row.failing).toEqual(["questions"]);
    expect(row.checks.questions.href).toBe("/admin/offerings/25?tab=questions");
  });

  it("no test → failing check is 'tests', link opens the Tests tab", () => {
    const row = computeReadinessRow(completeOffering({ testCount: 0 }), fullPlans());

    expect(row.failing).toEqual(["tests"]);
    expect(row.checks.tests.href).toBe("/admin/offerings/25?tab=tests");
  });

  it("no free sample → failing check is 'freeSample', link opens the Free sample tab", () => {
    const row = computeReadinessRow(completeOffering({ hasFreeSample: false }), fullPlans());

    expect(row.failing).toEqual(["freeSample"]);
    expect(row.checks.freeSample.count).toBe(0);
    expect(row.checks.freeSample.href).toBe("/admin/offerings/25?tab=free-sample");
  });

  it("an untouched offering is NOT_STARTED, not IN_PROGRESS", () => {
    const row = computeReadinessRow(
      completeOffering({ chapterCount: 0, questionCount: 0, testCount: 0, hasFreeSample: false }),
      [],
    );

    expect(row.status).toBe("NOT_STARTED");
    expect(row.done).toBe(0);
    expect(row.failing).toEqual([...READINESS_CHECKS]);
  });

  it("reports counts, not just booleans, so the UI can show progress", () => {
    const row = computeReadinessRow(
      completeOffering({ chapterCount: 16, questionCount: 756, testCount: 41 }),
      fullPlans(),
    );

    expect(row.checks.chapters.count).toBe(16);
    expect(row.checks.questions.count).toBe(756);
    expect(row.checks.tests.count).toBe(41);
    expect(row.planDurations).toEqual([3, 6, 12]);
  });

  it("builds the breadcrumb label from board code, class and subject", () => {
    expect(computeReadinessRow(completeOffering(), fullPlans()).label)
      .toBe("CBSE ▸ Class 10 ▸ Mathematics");
  });

  it("scopes pricing to the offering's own board+class", () => {
    // Plans priced for a different class must not make this one look ready.
    const otherClassPlans = fullPlans(BOARD.id, 999);
    const row = computeReadinessRow(completeOffering(), otherClassPlans);

    expect(row.checks.plans.done).toBe(false);
    expect(row.failing).toEqual(["plans"]);
  });

  it("requires all three terms — a partially priced class is not ready", () => {
    const partial = fullPlans().filter((p) => p.durationMonths !== 12);
    const row = computeReadinessRow(completeOffering(), partial);

    expect(row.checks.plans.done).toBe(false);
    expect(row.planDurations).toEqual([3, 6]);
  });
});

/**
 * The P0 transition: pricing a board+class in the admin grid is the last gate
 * standing between "0 of 30 ready" and a sellable shelf. These pin the exact
 * moment it flips, because the grid's whole promise is that saving a price
 * moves the number without a reload.
 */
describe("priced + active → ready", () => {
  it("flips a single offering from IN_PROGRESS to READY when its plans go live", () => {
    const offering = completeOffering();

    const unpriced = computeReadinessRow(offering, []);
    expect(unpriced.status).toBe("IN_PROGRESS");
    expect(unpriced.failing).toEqual(["plans"]);
    expect(unpriced.planDurations).toEqual([]);

    // Same offering, same content — only the plans changed.
    const priced = computeReadinessRow(offering, fullPlans());
    expect(priced.status).toBe("READY");
    expect(priced.failing).toEqual([]);
    expect(priced.checks.plans.done).toBe(true);
    expect(priced.planDurations).toEqual([3, 6, 12]);
  });

  it("a price alone is not enough — inactive plans leave the offering red", () => {
    // The trap the grid now surfaces: all three terms carry a price, but none
    // is active, so nothing is on sale and readiness must not go green.
    const row = computeReadinessRow(completeOffering(), inactivePlans());

    expect(row.status).toBe("IN_PROGRESS");
    expect(row.failing).toEqual(["plans"]);
    expect(row.planDurations).toEqual([]);
  });

  it("activating the same priced plans is what completes the gate", () => {
    const offering = completeOffering();
    const off = inactivePlans();

    expect(computeReadinessRow(offering, off).checks.plans.done).toBe(false);
    // Prices untouched; only isActive flips — exactly what saving a positive
    // price does in `writeRowsPricing`.
    const on = off.map((p) => ({ ...p, isActive: true }));
    expect(computeReadinessRow(offering, on).checks.plans.done).toBe(true);
  });

  it("moves the 'X of N ready' count for every offering sharing that board+class", () => {
    // Pricing is per board+class, so one save lifts the whole shelf of subjects.
    const offerings = [
      completeOffering({ id: 1, subject: SUBJECT_MATHS }),
      completeOffering({ id: 2, subject: SUBJECT_SCIENCE }),
      completeOffering({ id: 3, classId: 999 }), // a different class — untouched
    ];

    const before = computeReadiness(readinessInput(offerings, []));
    expect(before.summary.ready).toBe(0);

    const after = computeReadiness(readinessInput(offerings, fullPlans()));
    expect(after.summary.ready).toBe(2);
    expect(after.summary.inProgress).toBe(1);
    // The class nobody priced stays exactly where it was.
    expect(after.offerings[2].failing).toEqual(["plans"]);
  });
});

describe("computeReadiness — roll-up", () => {
  it("summary counts agree with the per-offering states", () => {
    const result = computeReadiness(
      readinessInput([
        completeOffering({ id: 1 }),                                   // READY
        completeOffering({ id: 2 }),                                   // READY
        completeOffering({ id: 3, hasFreeSample: false }),             // IN_PROGRESS
        completeOffering({                                             // NOT_STARTED
          id: 4, chapterCount: 0, questionCount: 0, testCount: 0, hasFreeSample: false,
          boardId: BOARD.id, classId: 999,
        }),
      ]),
    );

    expect(result.summary).toEqual({ total: 4, ready: 2, inProgress: 1, notStarted: 1 });
    // The headline must be derived from the rows, never counted separately.
    expect(result.summary.ready).toBe(result.offerings.filter((r) => r.status === "READY").length);
    expect(result.summary.total).toBe(result.offerings.length);
    expect(result.summary.ready + result.summary.inProgress + result.summary.notStarted)
      .toBe(result.summary.total);
  });

  it("'X of 30 ready' holds for a full 30-shelf board", () => {
    const offerings = Array.from({ length: 30 }, (_, i) =>
      // Only the first 7 are priced; the rest are complete but unpriced.
      completeOffering({ id: i + 1, classId: i < 7 ? CLASS_10.id : 100 + i }),
    );
    const result = computeReadiness(readinessInput(offerings));

    expect(result.summary.total).toBe(30);
    expect(result.summary.ready).toBe(7);
    expect(result.summary.inProgress).toBe(23);
    expect(result.offerings.filter((r) => r.failing.includes("plans"))).toHaveLength(23);
  });

  it("reflects the real starting state: content everywhere, nothing priced → 0 ready", () => {
    const result = computeReadiness(readinessInput([completeOffering(), unpricedOffering()], []));

    expect(result.summary.ready).toBe(0);
    expect(result.summary.inProgress).toBe(2);
    // Pricing is the *only* thing missing — that is what makes 0/30 truthful
    // rather than a symptom of some other gap.
    expect(result.offerings.map((r) => r.failing)).toEqual([["plans"], ["plans"]]);
  });

  it("handles an empty offering list without inventing a denominator", () => {
    const result = computeReadiness(readinessInput([]));
    expect(result.summary).toEqual({ total: 0, ready: 0, inProgress: 0, notStarted: 0 });
    expect(result.offerings).toEqual([]);
  });

  it("keeps each offering's checks independent", () => {
    const result = computeReadiness(
      readinessInput([
        completeOffering({ id: 10, subject: SUBJECT_MATHS, chapterCount: 0 }),
        completeOffering({ id: 11, subject: SUBJECT_SCIENCE, testCount: 0 }),
      ]),
    );

    expect(result.offerings[0].failing).toEqual(["chapters"]);
    expect(result.offerings[1].failing).toEqual(["tests"]);
  });
});
