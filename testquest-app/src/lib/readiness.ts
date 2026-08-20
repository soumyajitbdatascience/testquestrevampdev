/**
 * Launch-readiness computation — the logic behind the admin home page.
 *
 * Five gates decide whether a shelf can be sold. Four are content the offering
 * workspace owns; the fifth is commerce, shared across every offering in the
 * same board+class.
 *
 * Kept as a pure function, separate from the route that loads the data, for two
 * reasons: it is the thing that most visibly lies to the user if wrong, and
 * every gate carries a deep link that has to point at the screen that actually
 * fixes it.
 */
import { isFullyPriced, resolvePlanPricing, type PlanRow } from "@/lib/pricing";

export const READINESS_CHECKS = ["chapters", "questions", "tests", "freeSample", "plans"] as const;
export type ReadinessCheckKey = (typeof READINESS_CHECKS)[number];

export type ReadinessStatus = "READY" | "IN_PROGRESS" | "NOT_STARTED";

/** Workspace tab that fixes a gate; null when the fix lives outside the workspace. */
export type WorkspaceTab = "chapters" | "questions" | "tests" | "videos" | "free-sample";

export interface ReadinessCheck {
  key: ReadinessCheckKey;
  done: boolean;
  count: number;
  tab: WorkspaceTab | null;
  /** Where clicking this gate should land. */
  href: string;
}

export interface ReadinessOfferingInput {
  id: number;
  boardId: number;
  classId: number;
  subjectId: number;
  board: { id: number; name: string; code: string };
  class: { id: number; name: string };
  subject: { id: number; name: string };
  /** Chapters on this offering. */
  chapterCount: number;
  /** Questions carrying one of this offering's chapters — not the subject pool. */
  questionCount: number;
  testCount: number;
  hasFreeSample: boolean;
  videoCount?: number;
}

export interface ReadinessInput {
  offerings: ReadinessOfferingInput[];
  /** Subject-less board+class plans; scoping happens per offering. */
  plans: PlanRow[];
}

export interface ReadinessRow {
  id: number;
  label: string;
  board: ReadinessOfferingInput["board"];
  class: ReadinessOfferingInput["class"];
  subject: ReadinessOfferingInput["subject"];
  checks: Record<ReadinessCheckKey, ReadinessCheck>;
  /** Gates not yet met, in display order — the work still to do. */
  failing: ReadinessCheckKey[];
  done: number;
  total: number;
  status: ReadinessStatus;
  /** Terms currently on sale for this board+class. */
  planDurations: number[];
}

export interface ReadinessSummary {
  total: number;
  ready: number;
  inProgress: number;
  notStarted: number;
}

export interface ReadinessResult {
  summary: ReadinessSummary;
  offerings: ReadinessRow[];
}

export function offeringLabel(o: ReadinessOfferingInput): string {
  return `${o.board.code} ▸ ${o.class.name} ▸ ${o.subject.name}`;
}

/**
 * Deep link for a gate: into the workspace tab that fixes it, or out to the
 * pricing grid. The pricing link carries the board+class so the grid can scroll
 * to and highlight the one row that needs a price — landing on a 30-row grid
 * with no idea which row was meant is the same as not linking at all.
 */
function hrefFor(o: ReadinessOfferingInput, tab: WorkspaceTab | null): string {
  return tab
    ? `/admin/offerings/${o.id}?tab=${tab}`
    : `/admin/plans?boardId=${o.boardId}&classId=${o.classId}`;
}

/** Computes the five gates and roll-up for a single offering. */
export function computeReadinessRow(o: ReadinessOfferingInput, plans: PlanRow[]): ReadinessRow {
  const scope = { boardId: o.boardId, classId: o.classId };
  const pricing = resolvePlanPricing(plans, scope);

  const mk = (
    key: ReadinessCheckKey,
    done: boolean,
    count: number,
    tab: WorkspaceTab | null,
  ): ReadinessCheck => ({ key, done, count, tab, href: hrefFor(o, tab) });

  const checks: Record<ReadinessCheckKey, ReadinessCheck> = {
    chapters:   mk("chapters",   o.chapterCount > 0,  o.chapterCount,  "chapters"),
    questions:  mk("questions",  o.questionCount > 0, o.questionCount, "questions"),
    tests:      mk("tests",      o.testCount > 0,     o.testCount,     "tests"),
    freeSample: mk("freeSample", o.hasFreeSample,     o.hasFreeSample ? 1 : 0, "free-sample"),
    plans:      mk("plans",      isFullyPriced(plans, scope), pricing.availableDurations.length, null),
  };

  const failing = READINESS_CHECKS.filter((k) => !checks[k].done);
  const done = READINESS_CHECKS.length - failing.length;

  // NOT_STARTED is reserved for a shelf nobody has touched at all; anything
  // partially set up is IN_PROGRESS so it stays visible as work in flight.
  const status: ReadinessStatus =
    done === READINESS_CHECKS.length ? "READY" : done === 0 ? "NOT_STARTED" : "IN_PROGRESS";

  return {
    id: o.id,
    label: offeringLabel(o),
    board: o.board,
    class: o.class,
    subject: o.subject,
    checks,
    failing,
    done,
    total: READINESS_CHECKS.length,
    status,
    planDurations: pricing.availableDurations,
  };
}

/**
 * Computes readiness for every offering plus the top-line roll-up.
 *
 * The summary is derived from the rows it returns, so "X of N ready" can never
 * disagree with the table beneath it.
 */
export function computeReadiness(input: ReadinessInput): ReadinessResult {
  const offerings = input.offerings.map((o) => computeReadinessRow(o, input.plans));

  return {
    summary: {
      total: offerings.length,
      ready: offerings.filter((r) => r.status === "READY").length,
      inProgress: offerings.filter((r) => r.status === "IN_PROGRESS").length,
      notStarted: offerings.filter((r) => r.status === "NOT_STARTED").length,
    },
    offerings,
  };
}
