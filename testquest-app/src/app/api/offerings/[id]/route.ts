import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import { hasClassAccess, resolveAccessForTests } from "@/lib/access";
import { deriveTestChapters } from "@/lib/student-content";
import { listStudentContexts } from "@/lib/student-context";

type Params = { params: Promise<{ id: string }> };

/**
 * The subject page — chapters in admin order, each with its tests and videos,
 * plus a trailing "More tests" group so nothing can vanish.
 *
 * **`[id]` is an offering id.** A subject on its own is not a browsable thing
 * here — Biology means nothing until it is Biology *for CBSE Class 9*, which
 * is exactly what an offering is. The route was `/subjects/[id]` while it was
 * keyed by subject; the path now says what it takes.
 *
 * Lock state comes from the shared access resolver, so this page can never
 * disagree with what the attempt route will allow. Nothing here leaks content:
 * a locked test shows its name and question count, never its questions.
 *
 * Scope: a signed-in student may only open an offering in a board+class they
 * hold a context for. Without this, typing any offering id rendered another
 * class's subject page under a header that said they were in a different
 * class — locked, but visible, and flatly contradicting "you only ever see
 * your class". Access (what may be *opened*) is still `hasClassAccess`; this
 * is only about what is in scope to look at.
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const offeringId = Number(id);
    if (!Number.isFinite(offeringId)) return error("Invalid offering id", 400);

    const session = await getSession();
    const studentId = session?.role === "student" ? session.id : null;

    const offering = await prisma.offering.findFirst({
      where: { id: offeringId, isActive: true },
      select: {
        id: true, boardId: true, classId: true,
        board: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        freeTest: { select: { testId: true } },
        chapters: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { id: true, name: true },
        },
        tests: {
          where: { isActive: true },
          orderBy: [{ name: "asc" }],
          select: {
            id: true, name: true, durationMinutes: true, totalMarks: true,
            isPractice: true, _count: { select: { questions: true } },
          },
        },
        videos: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }],
          select: { id: true, chapterId: true, title: true, durationSeconds: true },
        },
      },
    });
    if (!offering) return error("Subject not found", 404);

    // Out of the student's scope → the same answer as a subject that doesn't
    // exist. Checked against every context they hold, not just the active one,
    // so a two-class student following a link to their *other* class still
    // works; only classes they have never added are refused.
    if (studentId) {
      const contexts = await listStudentContexts(studentId);
      const inScope = contexts.some(
        (c) => c.boardId === offering.boardId && c.classId === offering.classId,
      );
      if (!inScope) return error("Subject not found", 404);
    }

    const testIds = offering.tests.map((t) => t.id);
    const [accessMap, placement, attempts] = await Promise.all([
      resolveAccessForTests(studentId, testIds),
      deriveTestChapters(offering.id),
      studentId && testIds.length > 0
        ? prisma.attempt.findMany({
            where: { studentId, testId: { in: testIds }, status: "COMPLETED" },
            select: { testId: true, score: true, totalMarks: true },
          })
        : Promise.resolve([]),
    ]);

    // Best percentage per test — the "done · 72%" chip.
    const best = new Map<number, number>();
    for (const a of attempts) {
      if (a.totalMarks <= 0) continue;
      const pct = Math.round((a.score / a.totalMarks) * 100);
      best.set(a.testId, Math.max(best.get(a.testId) ?? 0, pct));
    }

    const freeSampleTestId = offering.freeTest?.testId ?? null;

    const testPayload = (t: (typeof offering.tests)[number]) => {
      const access = accessMap.get(t.id) ?? { access: false, reason: "NONE" as const };
      const place = placement.get(t.id);
      return {
        id: t.id,
        name: t.name,
        durationMinutes: t.durationMinutes,
        totalMarks: t.totalMarks,
        questionCount: t._count.questions,
        isPractice: t.isPractice,
        isSample: t.id === freeSampleTestId,
        access: access.access,
        accessReason: access.reason,
        bestPct: best.get(t.id) ?? null,
        extraChapters: place?.extraChapters ?? 0,
      };
    };

    // Videos are complimentary with the pass and never sold alone. The
    // playable id is NEVER in this list payload regardless of entitlement —
    // `/api/videos/[id]` is the single place it is handed out, after its own
    // check. `locked` here only drives how the tile is drawn.
    const subscribed = await hasClassAccess(studentId, offering.boardId, offering.classId);
    const videoPayload = (v: (typeof offering.videos)[number]) => ({
      id: v.id,
      chapterId: v.chapterId,
      title: v.title,
      durationSeconds: v.durationSeconds,
      locked: !subscribed,
    });

    const chapters = offering.chapters.map((c) => {
      const ctests = offering.tests.filter((t) => placement.get(t.id)?.chapterId === c.id).map(testPayload);
      return {
        id: c.id,
        name: c.name,
        tests: ctests,
        videos: offering.videos.filter((v) => v.chapterId === c.id).map(videoPayload),
        doneCount: ctests.filter((t) => t.bestPct != null).length,
      };
    });

    // Anything the derivation couldn't place (a test whose questions carry no
    // chapter) still has to be reachable.
    const placedIds = new Set(chapters.flatMap((c) => c.tests.map((t) => t.id)));
    const moreTests = offering.tests.filter((t) => !placedIds.has(t.id)).map(testPayload);
    const chapterIds = new Set(offering.chapters.map((c) => c.id));
    const looseVideos = offering.videos
      .filter((v) => v.chapterId == null || !chapterIds.has(v.chapterId))
      .map(videoPayload);

    const plans = await prisma.b2cPlan.findMany({
      where: { boardId: offering.boardId, classId: offering.classId, subjectId: null, isActive: true },
      select: { price: true },
    });

    return success({
      offeringId: offering.id,
      board: offering.board,
      class: offering.class,
      subject: offering.subject,
      subscribed,
      freeSampleTestId,
      hasSample: freeSampleTestId != null,
      chapters,
      moreTests,
      looseVideos,
      counts: {
        chapters: offering.chapters.length,
        tests: offering.tests.length,
        videos: offering.videos.length,
      },
      minPrice: plans.length ? Math.min(...plans.map((p) => Number(p.price))) : null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
