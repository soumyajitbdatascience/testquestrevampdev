import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, success } from "@/lib/api-utils";
import { hasClassAccess } from "@/lib/access";
import { listOfferingsForScope } from "@/lib/student-content";
import { listStudentContexts, resolveActiveContext } from "@/lib/student-context";

/**
 * Home (1b/3d): everything the context-scoped home needs in one call — the
 * active context and its pass status, a resume card, the plans teaser, and one
 * card per subject.
 *
 * A card is an **offering** (this subject, on this board, for this class), so
 * "whatever subjects exist" is answered by the data rather than by a hardcoded
 * list — one Science card or three both just work.
 *
 * Access is per board+class, not per card: one pass unlocks every subject
 * here. The cards therefore carry no lock flag of their own — `subscribed` on
 * the context is the answer for all of them.
 */
export async function GET() {
  try {
    const session = await requireAuth("student");
    const studentId = session.id;
    const now = new Date();

    // Scope comes from the `tq_ctx` cookie, validated against this student's
    // own contexts. It used to come from a `?contextId=` query param, which
    // meant the client decided the scope and nothing carried it between
    // pages. Removing the param also removes the only way to ask for a
    // context by id.
    const contexts = await listStudentContexts(studentId);
    if (contexts.length === 0) return success({ needsOnboarding: true });
    const ctx = (await resolveActiveContext(studentId, contexts))!;

    const [board, cls, pass, plans, offerings] = await Promise.all([
      prisma.board.findUnique({ where: { id: ctx.boardId }, select: { name: true, code: true } }),
      prisma.class.findUnique({ where: { id: ctx.classId }, select: { name: true } }),
      prisma.classAccess.findFirst({
        where: { studentId, boardId: ctx.boardId, classId: ctx.classId, startsAt: { lte: now }, expiresAt: { gt: now } },
        orderBy: { expiresAt: "desc" },
      }),
      prisma.b2cPlan.findMany({
        where: { boardId: ctx.boardId, classId: ctx.classId, subjectId: null, isActive: true },
        select: { price: true },
      }),
      listOfferingsForScope(ctx.boardId, ctx.classId),
    ]);

    const daysLeft = pass ? Math.ceil((pass.expiresAt.getTime() - now.getTime()) / 86400e3) : null;
    const minPrice = plans.length ? Math.min(...plans.map((p) => Number(p.price))) : null;

    // Resume card — the most recent unfinished paper in this context.
    const inFlight = await prisma.attempt.findFirst({
      where: {
        studentId,
        status: "IN_PROGRESS",
        test: { offering: { boardId: ctx.boardId, classId: ctx.classId } },
      },
      orderBy: { startedAt: "desc" },
      select: {
        id: true, testId: true, startedAt: true,
        test: { select: { name: true, durationMinutes: true, isPractice: true } },
        _count: { select: { answers: true } },
        answers: { where: { selectedOptionIds: { not: null } }, select: { id: true } },
      },
    });
    // `startedAt` + `durationMinutes` travel together so the card can say
    // "14 min left" without a second call. Practice papers are untimed, so
    // they carry no clock rather than a fake one — the card omits the phrase.
    //
    // This is display only. The attempt engine remains the single authority on
    // whether time has actually run out; nothing here can start, extend or
    // expire an attempt.
    const resume = inFlight
      ? {
          attemptId: inFlight.id,
          testId: inFlight.testId,
          testName: inFlight.test.name,
          answered: inFlight.answers.length,
          total: inFlight._count.answers,
          startedAt: inFlight.startedAt,
          durationMinutes: inFlight.test.isPractice ? null : inFlight.test.durationMinutes,
        }
      : null;

    // Completed attempts in this scope, for the per-card progress line.
    const attempts = await prisma.attempt.findMany({
      where: {
        studentId,
        status: "COMPLETED",
        test: { offering: { boardId: ctx.boardId, classId: ctx.classId } },
      },
      select: { testId: true, score: true, totalMarks: true, test: { select: { offeringId: true } } },
    });
    const progress = new Map<number, { tests: Set<number>; pctSum: number; pctCount: number }>();
    for (const a of attempts) {
      const entry = progress.get(a.test.offeringId) ?? { tests: new Set<number>(), pctSum: 0, pctCount: 0 };
      entry.tests.add(a.testId);
      if (a.totalMarks > 0) {
        entry.pctSum += (a.score / a.totalMarks) * 100;
        entry.pctCount++;
      }
      progress.set(a.test.offeringId, entry);
    }

    // Gap 2 — "Continue · {next test}". One query for every test in scope,
    // then the first one this student has not completed, per offering.
    //
    // Deliberately not a per-offering correlated lookup: that would be one
    // round trip per subject card, and the shared host caps a statement at
    // 10s. This is a single indexed read over one class's tests.
    //
    // Scoping is the same rule as everywhere else — the `offering` filter is
    // the active context, so a suggestion can only ever name a paper from the
    // class being viewed.
    const testsInScope = await prisma.test.findMany({
      where: { isActive: true, offering: { boardId: ctx.boardId, classId: ctx.classId, isActive: true } },
      orderBy: [{ offeringId: "asc" }, { name: "asc" }],
      select: { id: true, name: true, offeringId: true },
    });
    const nextByOffering = new Map<number, { id: number; name: string }>();
    for (const t of testsInScope) {
      if (nextByOffering.has(t.offeringId)) continue;
      if (progress.get(t.offeringId)?.tests.has(t.id)) continue;
      nextByOffering.set(t.offeringId, { id: t.id, name: t.name });
    }

    const subscribed = await hasClassAccess(studentId, ctx.boardId, ctx.classId);

    return success({
      needsOnboarding: false,
      context: {
        id: ctx.id,
        boardId: ctx.boardId,
        boardName: board?.name ?? "",
        boardCode: board?.code ?? "",
        classId: ctx.classId,
        className: cls?.name ?? `Class ${ctx.classId}`,
        subscribed,
        passExpiresAt: pass?.expiresAt ?? null,
        daysLeft,
      },
      resume,
      minPrice,
      totals: {
        subjects: offerings.length,
        tests: offerings.reduce((n, o) => n + o.testCount, 0),
        videos: offerings.reduce((n, o) => n + o.videoCount, 0),
      },
      subjects: offerings.map((o) => {
        const p = progress.get(o.offeringId);
        return {
          // `id` is the OFFERING id — what /offerings/[id] is keyed by.
          id: o.offeringId,
          subjectId: o.subjectId,
          name: o.subjectName,
          chapterCount: o.chapterCount,
          testCount: o.testCount,
          videoCount: o.videoCount,
          freeTestId: o.freeSampleTestId,
          // null once every test in the subject has been sat — the card then
          // says "Revise" rather than naming a paper that doesn't exist.
          nextTest: nextByOffering.get(o.offeringId) ?? null,
          attemptedCount: p?.tests.size ?? 0,
          avgPct: p && p.pctCount > 0 ? Math.round(p.pctSum / p.pctCount) : null,
        };
      }),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
