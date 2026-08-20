/**
 * Catalogue reads for the student app, on the decoupled model.
 *
 * Replaces the `vw_*` compatibility views the old student code read: this
 * database has no views at all, so anything still selecting from `vw_classes`
 * or `vw_tests` is a 500 waiting to happen. The shape here follows the model
 * the admin writes — Board · Class → Offering (a subject on that board+class)
 * → Chapter → Test — so student and admin can never disagree about what
 * exists.
 *
 * Phase 1 needs the taxonomy: which boards, which classes under a board, and
 * whether a board+class actually carries content. The per-offering reads
 * (chapters, tests, videos) arrive with the home and subject surfaces.
 */
import { prisma } from "@/lib/db";

export interface BoardOption {
  id: number;
  name: string;
  code: string;
}

export interface ClassOption {
  id: number;
  name: string;
  sortOrder: number;
  /** Active offerings on this board+class — 0 means "nothing to study yet". */
  offeringCount: number;
}

/** Boards a student can onboard into. */
export async function listBoards(): Promise<BoardOption[]> {
  const boards = await prisma.board.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, code: true },
  });
  return boards;
}

/**
 * Classes mapped to a board, each with how much content it carries.
 *
 * Classes with no offerings are returned rather than hidden: picking one is a
 * legitimate choice (the content may land next week) and the home page has a
 * guided empty state for it. Hiding them would make the board look broken.
 */
export async function listClassesForBoard(boardId: number): Promise<ClassOption[]> {
  const [mapped, offerings] = await Promise.all([
    prisma.boardClass.findMany({
      where: { boardId, isActive: true, class: { isActive: true } },
      orderBy: [{ sortOrder: "asc" }, { class: { sortOrder: "asc" } }],
      select: { class: { select: { id: true, name: true, sortOrder: true } } },
    }),
    prisma.offering.groupBy({
      by: ["classId"],
      where: { boardId, isActive: true },
      _count: { _all: true },
    }),
  ]);

  const countByClass = new Map(offerings.map((o) => [o.classId, o._count._all]));
  return mapped.map((m) => ({
    id: m.class.id,
    name: m.class.name,
    sortOrder: m.class.sortOrder,
    offeringCount: countByClass.get(m.class.id) ?? 0,
  }));
}

/**
 * Is this a real board+class a student may hold a context for?
 *
 * Validates against the board→class mapping rather than the class table alone,
 * so a student cannot bind themselves to "CBSE · Class 4" when CBSE does not
 * run Class 4.
 */
export async function isValidBoardClass(boardId: number, classId: number): Promise<boolean> {
  const row = await prisma.boardClass.findFirst({
    where: { boardId, classId, isActive: true, board: { isActive: true }, class: { isActive: true } },
    select: { id: true },
  });
  return row != null;
}

/** Subject cards for one board+class — the home grid. */
export interface OfferingCard {
  offeringId: number;
  subjectId: number;
  subjectName: string;
  chapterCount: number;
  testCount: number;
  videoCount: number;
  /** The one sit-able-without-a-pass test, if the admin has designated one. */
  freeSampleTestId: number | null;
}

export async function listOfferingsForScope(boardId: number, classId: number): Promise<OfferingCard[]> {
  const offerings = await prisma.offering.findMany({
    where: { boardId, classId, isActive: true, subject: { isActive: true } },
    orderBy: [{ sortOrder: "asc" }, { subject: { name: "asc" } }],
    select: {
      id: true,
      subject: { select: { id: true, name: true } },
      freeTest: { select: { testId: true } },
      // Counted with the same `isActive` filter the paywall's /api/plans uses.
      // Unfiltered, these included soft-deleted rows, so Home's banner sold a
      // class on "6 chapter-wise tests" while the paywall for that same class
      // said 5 — and the extra one was a test no student could open.
      _count: {
        select: {
          chapters: { where: { isActive: true } },
          tests: { where: { isActive: true } },
          videos: { where: { isActive: true } },
        },
      },
    },
  });

  return offerings.map((o) => ({
    offeringId: o.id,
    subjectId: o.subject.id,
    subjectName: o.subject.name,
    chapterCount: o._count.chapters,
    testCount: o._count.tests,
    videoCount: o._count.videos,
    freeSampleTestId: o.freeTest?.testId ?? null,
  }));
}

/**
 * Which chapter each of an offering's tests belongs under.
 *
 * There is no test→chapter link in the model: a test hangs off the offering
 * and only its *questions* carry chapters. So placement is **derived** — a
 * test sits under the chapter holding most of its questions, ties broken by
 * the earlier chapter, and `extraChapters` records how many others it touches
 * so the UI can say "+1 more chapter" rather than pretending it's tidy.
 *
 * Worth knowing: 158 of 269 tests draw on two chapters, so that note is the
 * common case, not an edge case. Nothing is stored — retagging in admin
 * changes placement immediately.
 *
 * One grouped query per page; a per-test lookup would be 30+ round trips.
 */
export async function deriveTestChapters(
  offeringId: number,
): Promise<Map<number, { chapterId: number; extraChapters: number }>> {
  const rows = await prisma.$queryRaw<Array<{ testId: number; chapterId: number; chapterSort: number; n: bigint }>>`
    SELECT tq.testId          AS testId,
           q.chapterId        AS chapterId,
           ch.sortOrder       AS chapterSort,
           COUNT(*)           AS n
    FROM tq_test_questions tq
    JOIN tq_questions q  ON q.id = tq.questionId AND q.isActive = 1
    JOIN tq_chapters ch  ON ch.id = q.chapterId AND ch.isActive = 1
    JOIN tq_tests t      ON t.id = tq.testId
    WHERE t.offeringId = ${offeringId} AND t.isActive = 1
    GROUP BY tq.testId, q.chapterId, ch.sortOrder`;

  const byTest = new Map<number, Array<{ chapterId: number; chapterSort: number; n: number }>>();
  for (const r of rows) {
    const testId = Number(r.testId);
    const list = byTest.get(testId) ?? [];
    list.push({ chapterId: Number(r.chapterId), chapterSort: Number(r.chapterSort), n: Number(r.n) });
    byTest.set(testId, list);
  }

  const out = new Map<number, { chapterId: number; extraChapters: number }>();
  for (const [testId, list] of byTest) {
    list.sort((a, b) => b.n - a.n || a.chapterSort - b.chapterSort || a.chapterId - b.chapterId);
    out.set(testId, { chapterId: list[0].chapterId, extraChapters: list.length - 1 });
  }
  return out;
}

export interface TaxonomySubject {
  id: number;
  name: string;
  chapters: never[];
}

export interface TaxonomyClass {
  id: number;
  name: string;
  subjects: TaxonomySubject[];
}

/**
 * Class → subjects tree, kept in the exact shape the old view-backed endpoint
 * returned so its six consumers (student browse, profile, onboarding and two
 * admin pickers) keep working unchanged.
 *
 * A subject appears under a class when some board offers it there; the board
 * dimension is collapsed because this endpoint has never carried one.
 */
export async function getTaxonomyTree(): Promise<TaxonomyClass[]> {
  const offerings = await prisma.offering.findMany({
    where: { isActive: true, class: { isActive: true }, subject: { isActive: true } },
    select: {
      class: { select: { id: true, name: true, sortOrder: true } },
      subject: { select: { id: true, name: true } },
    },
    orderBy: [{ class: { sortOrder: "asc" } }, { subject: { name: "asc" } }],
  });

  const byClass = new Map<number, TaxonomyClass & { sortOrder: number }>();
  for (const o of offerings) {
    let entry = byClass.get(o.class.id);
    if (!entry) {
      entry = { id: o.class.id, name: o.class.name, sortOrder: o.class.sortOrder, subjects: [] };
      byClass.set(o.class.id, entry);
    }
    // The same subject can be offered by several boards in one class.
    if (!entry.subjects.some((s) => s.id === o.subject.id)) {
      entry.subjects.push({ id: o.subject.id, name: o.subject.name, chapters: [] });
    }
  }

  return [...byClass.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map(({ id, name, subjects }) => ({ id, name, subjects }));
}
