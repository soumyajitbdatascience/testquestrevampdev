/**
 * Fixture factory (§3.4).
 *
 * One board (CBSE), two classes, two subjects, two offerings — one complete and
 * priced, one complete but unpriced — plus questions, a test, a free sample and
 * 3/6/12 plans.
 *
 * States are explicit rather than implied: `completeOffering()` returns a shelf
 * that passes all five readiness gates, and each `without*` helper removes
 * exactly one gate, so a failing assertion names the gate that broke.
 */
import type { ReadinessInput, ReadinessOfferingInput } from "@/lib/readiness";
import type { PlanRow } from "@/lib/pricing";

export const BOARD = { id: 1, name: "CBSE", code: "CBSE", sortOrder: 1 };
export const CLASS_9 = { id: 4, name: "Class 9", sortOrder: 9 };
export const CLASS_10 = { id: 5, name: "Class 10", sortOrder: 10 };
export const SUBJECT_MATHS = { id: 1, name: "Mathematics" };
export const SUBJECT_SCIENCE = { id: 2, name: "Science" };

/** Plans covering all three terms for a board+class — the priced state. */
export function fullPlans(boardId = BOARD.id, classId = CLASS_10.id): PlanRow[] {
  return [
    { boardId, classId, durationMonths: 3, price: 499, isActive: true },
    { boardId, classId, durationMonths: 6, price: 899, isActive: true },
    { boardId, classId, durationMonths: 12, price: 1499, isActive: true },
  ];
}

/**
 * All three terms priced but switched off — the state the admin grid used to
 * hide. It must never read as sellable, and it is the step before "active" in
 * the priced → ready transition.
 */
export function inactivePlans(boardId = BOARD.id, classId = CLASS_10.id): PlanRow[] {
  return fullPlans(boardId, classId).map((p) => ({ ...p, isActive: false }));
}

/**
 * A shelf that passes every gate. Override any field to knock out exactly one —
 * that is how the readiness tests stay readable.
 */
export function completeOffering(
  overrides: Partial<ReadinessOfferingInput> = {},
): ReadinessOfferingInput {
  return {
    id: 25,
    boardId: BOARD.id,
    classId: CLASS_10.id,
    subjectId: SUBJECT_MATHS.id,
    board: BOARD,
    class: CLASS_10,
    subject: SUBJECT_MATHS,
    chapterCount: 16,
    questionCount: 756,
    testCount: 41,
    hasFreeSample: true,
    videoCount: 0,
    ...overrides,
  };
}

/** The second shelf from §3.4: complete content, no pricing. */
export function unpricedOffering(): ReadinessOfferingInput {
  return completeOffering({ id: 19, classId: CLASS_9.id, class: CLASS_9 });
}

/** Wraps offerings into the shape `computeReadiness` consumes. */
export function readinessInput(
  offerings: ReadinessOfferingInput[],
  plans: PlanRow[] = fullPlans(),
): ReadinessInput {
  return { offerings, plans };
}
