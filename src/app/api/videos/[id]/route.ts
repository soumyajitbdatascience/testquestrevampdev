import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import { hasClassAccess } from "@/lib/access";
import { listStudentContexts } from "@/lib/student-context";

/**
 * Video detail for the player page (design 1h).
 *
 * GOVERNANCE: the YouTube id (`videoRef`) leaves the server ONLY for a student
 * whose pass covers this video's board+class. Videos are unlisted, so the id
 * *is* the access control — anyone holding it can watch, and a YouTube
 * thumbnail URL contains it, which is why a locked response carries neither.
 * The locked payload is title, duration, chapter and the upsell scope; the
 * client draws a branded placeholder from that.
 *
 * The check runs through `hasClassAccess`, the same helper the test player and
 * the paywall use. This route used to hand-roll its own query which tested
 * `expiresAt > now` but not `startsAt <= now` — so a pass bought as a renewal,
 * whose window has not opened yet, would have unlocked video content early.
 * One access rule, one place.
 *
 * Scope is separate from access: a signed-in student may only reach a video in
 * a board+class they hold a context for. Even the locked payload names a
 * subject and chapter, and naming another class's chapters under a header that
 * says they are in a different class is the leak this pass exists to close.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const videoId = Number(id);
    if (!Number.isFinite(videoId)) return error("Invalid video id", 400);

    // The video's board/class/subject now come from its offering.
    const video = await prisma.video.findFirst({
      where: { id: videoId, isActive: true },
      include: { offering: { include: { board: true, class: true, subject: true } } },
    });
    if (!video) return error("Video not found", 404);
    const { offering } = video;

    const session = await getSession();

    if (session?.role === "student") {
      const contexts = await listStudentContexts(session.id);
      const inScope = contexts.some(
        (c) => c.boardId === offering.boardId && c.classId === offering.classId,
      );
      // Out of scope is indistinguishable from nonexistent.
      if (!inScope) return error("Video not found", 404);
    }

    const covered = session?.role === "admin"
      ? true
      : await hasClassAccess(
          session?.role === "student" ? session.id : null,
          offering.boardId,
          offering.classId,
        );

    const chapter = video.chapterId
      ? await prisma.chapter.findUnique({ where: { id: video.chapterId }, select: { name: true } })
      : null;

    // "Up next": sibling videos + chapter tests (subscribed only, mixed list)
    const siblings = await prisma.video.findMany({
      where: {
        offeringId: video.offeringId,
        chapterId: video.chapterId, isActive: true, id: { not: video.id },
      },
      orderBy: { sortOrder: "asc" },
      take: 4,
    });
    // "Up next" used to mix in the chapter's tests via `tq_chapter_tests`, a
    // join table that does not exist here. In the decoupled model a test hangs
    // off the *offering* and only its questions carry chapters, so the
    // chapter→test relationship has to be derived rather than looked up —
    // that belongs with the subject/chapter surface in Phase 2.
    const chapterTests: Array<{ id: number; name: string }> = [];

    // Upsell scope for the locked route
    let minPrice: number | null = null;
    if (!covered) {
      const plans = await prisma.b2cPlan.findMany({
        where: { boardId: offering.boardId, classId: offering.classId, subjectId: null, isActive: true },
        select: { price: true },
      });
      minPrice = plans.length ? Math.min(...plans.map((p) => Number(p.price))) : null;
    }

    // Sibling position for "Video 1 of 2"
    const allInChapter = await prisma.video.count({
      where: { offeringId: video.offeringId, chapterId: video.chapterId, isActive: true },
    });
    const position = await prisma.video.count({
      where: {
        offeringId: video.offeringId,
        chapterId: video.chapterId, isActive: true, sortOrder: { lte: video.sortOrder }, id: { lte: video.id },
      },
    });

    return success({
      id: video.id,
      title: video.title,
      durationSeconds: video.durationSeconds,
      // The offering this video belongs to. `/offerings/[id]` is keyed by
      // OFFERING id, so a page that only knew the subject id could not build a
      // correct link back — it sent students to whichever offering happened to
      // share that number.
      offeringId: offering.id,
      covered,
      ...(covered ? { videoRef: video.videoRef } : {}),
      board: { id: offering.boardId, name: offering.board.name, code: offering.board.code },
      class: { id: offering.classId, name: offering.class.name },
      subject: { id: offering.subjectId, name: offering.subject.name },
      chapter: video.chapterId ? { id: video.chapterId, name: chapter?.name ?? "" } : null,
      position, totalInChapter: allInChapter,
      upNext: {
        videos: siblings.map((v) => ({
          id: v.id, title: v.title, durationSeconds: v.durationSeconds,
          ...(covered ? { videoRef: v.videoRef } : {}),
        })),
        tests: chapterTests,
      },
      minPrice,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
