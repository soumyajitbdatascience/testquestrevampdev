/**
 * Access resolution for the B2C pass model — the single source of truth for
 * "may this student take this test?".
 *
 * Resolution order (first hit wins):
 *   FREE_SAMPLE — the one admin-designated test per offering (tq_free_tests),
 *                 sit-able by anyone, signed in or not
 *   CLASS_PASS  — an active tq_class_access row whose (boardId, classId)
 *                 matches the board+class of the test's offering
 *   NONE        — locked; the UI opens the paywall (a lock is a doorway)
 *
 * **Fail closed.** Anything unresolvable — unknown test id, inactive test, a
 * pass outside its validity window — is NONE. Never free-by-accident: the
 * money depends on this file being wrong in the *safe* direction.
 *
 * Two branches were deliberately removed at the cutover to the clean DB:
 *
 * - `LEGACY_FREE` (honouring `tq_tests.isFree`). The migration set that flag on
 *   **every** row — all 270 active tests carry `isFree = true` — so honouring
 *   it would unlock the entire catalogue and the paywall could never bite. In
 *   the new model "free" means exactly one thing: the offering's free sample.
 * - `GRANDFATHERED` / `ASSIGNMENT`. These read `tq_student_access`,
 *   `tq_batch_enrollments` and `tq_assignments`, none of which exist in this
 *   database. Students start at zero here, and coaching assignments are a B2B
 *   concern that no student path may reach.
 *
 * POLICY (verified behaviour, keep): in-flight attempts resume regardless of
 * access expiry — callers must run their resume check BEFORE calling this.
 */
import { prisma } from "@/lib/db";

export type AccessReason = "FREE_SAMPLE" | "CLASS_PASS" | "NONE";

export interface TestAccess {
  access: boolean;
  reason: AccessReason;
}

const LOCKED: TestAccess = { access: false, reason: "NONE" };

/**
 * Does this student hold a live pass for this board+class right now?
 *
 * The gate every locked resource is checked against — test questions on
 * attempt start, video ids, and anything else added later.
 */
export async function hasClassAccess(
  studentId: number | null,
  boardId: number,
  classId: number,
): Promise<boolean> {
  if (!studentId) return false;
  const now = new Date();
  const pass = await prisma.classAccess.findFirst({
    where: { studentId, boardId, classId, startsAt: { lte: now }, expiresAt: { gt: now } },
    select: { id: true },
  });
  return pass != null;
}

export async function resolveTestAccess(
  studentId: number | null,
  testId: number,
): Promise<TestAccess> {
  const map = await resolveAccessForTests(studentId, [testId]);
  return map.get(testId) ?? LOCKED;
}

/**
 * Bulk variant for list endpoints — a fixed number of queries for N tests
 * (a per-row check would blow the 10s statement ceiling on the shared host).
 *
 * Every requested id gets an entry, so a caller can never read a missing key
 * as "no opinion" and default it open.
 */
export async function resolveAccessForTests(
  studentId: number | null,
  testIds: number[],
): Promise<Map<number, TestAccess>> {
  const out = new Map<number, TestAccess>();
  const ids = [...new Set(testIds)];
  if (ids.length === 0) return out;

  // Free samples are public — they are the "try before you pay" surface.
  const sampleIds = new Set(
    (await prisma.freeTest.findMany({ where: { testId: { in: ids } }, select: { testId: true } }))
      .map((r) => r.testId),
  );

  if (!studentId) {
    for (const id of ids) {
      out.set(id, sampleIds.has(id) ? { access: true, reason: "FREE_SAMPLE" } : LOCKED);
    }
    return out;
  }

  const now = new Date();

  // A handful of rows at most — a student holds one pass per class they bought.
  const passes = await prisma.classAccess.findMany({
    where: { studentId, startsAt: { lte: now }, expiresAt: { gt: now } },
    select: { boardId: true, classId: true },
  });
  const passScopes = new Set(passes.map((p) => `${p.boardId}:${p.classId}`));

  // A test's board+class comes straight from its offering — the decoupled
  // model replaced the old chapter-tagging indirection. Inactive tests are
  // left out of the map, so they resolve to NONE below.
  const scopeByTest = new Map<number, string>();
  if (passScopes.size > 0) {
    const rows = await prisma.test.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true, offering: { select: { boardId: true, classId: true } } },
    });
    for (const r of rows) scopeByTest.set(r.id, `${r.offering.boardId}:${r.offering.classId}`);
  }

  for (const id of ids) {
    if (sampleIds.has(id)) {
      out.set(id, { access: true, reason: "FREE_SAMPLE" });
      continue;
    }
    const scope = scopeByTest.get(id);
    out.set(id, scope && passScopes.has(scope) ? { access: true, reason: "CLASS_PASS" } : LOCKED);
  }
  return out;
}

/** The student's active passes, newest expiry first (for home/paywall/subscriptions). */
export async function getActivePasses(studentId: number) {
  const now = new Date();
  return prisma.classAccess.findMany({
    where: { studentId, startsAt: { lte: now }, expiresAt: { gt: now } },
    orderBy: { expiresAt: "desc" },
  });
}

/** Current expiry for a (student, board, class) scope — renewal extends from here. */
export async function currentExpiry(studentId: number, boardId: number, classId: number): Promise<Date | null> {
  const row = await prisma.classAccess.findFirst({
    where: { studentId, boardId, classId },
    orderBy: { expiresAt: "desc" },
    select: { expiresAt: true },
  });
  return row?.expiresAt ?? null;
}
