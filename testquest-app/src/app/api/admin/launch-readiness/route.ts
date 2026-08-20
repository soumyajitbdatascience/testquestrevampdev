import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, success } from "@/lib/api-utils";
import { computeReadiness } from "@/lib/readiness";
import type { PlanRow } from "@/lib/pricing";

/**
 * Launch readiness — the admin home.
 *
 * One row per offering with the five things a shelf needs before it can be
 * sold, plus a "needs attention" tray that turns known gaps into a to-do list.
 *
 * Everything here is computed with grouped queries over the whole dataset —
 * never per row. The shared host enforces a 10-second statement ceiling, and a
 * per-offering subquery across 30 offerings and 5,473 questions would blow it.
 */

/** The five gates. Four are content; plans is commerce, shared per board+class. */


export async function GET() {
  try {
    await requireAuth("admin");

    const [offerings, chapterQuestionCounts, plans, emptyTests, untaggedBySubject] = await Promise.all([
      prisma.offering.findMany({
        where: { isActive: true },
        include: {
          board: { select: { id: true, name: true, code: true, sortOrder: true } },
          class: { select: { id: true, name: true, sortOrder: true } },
          subject: { select: { id: true, name: true } },
          freeTest: { select: { testId: true } },
          _count: { select: { chapters: true, tests: true, videos: true } },
        },
        orderBy: [{ board: { sortOrder: "asc" } }, { class: { sortOrder: "asc" } }, { subject: { name: "asc" } }],
      }),

      // Questions per offering, via the chapters that scope them to a shelf.
      prisma.chapter.findMany({
        where: { isActive: true },
        select: { offeringId: true, _count: { select: { questions: { where: { isActive: true } } } } },
      }),

      prisma.b2cPlan.findMany({
        where: { subjectId: null },
        select: { boardId: true, classId: true, durationMonths: true, price: true, isActive: true },
      }),

      // Live tests carrying no questions — a student would open an empty paper.
      prisma.test.findMany({
        where: { isActive: true, questions: { none: {} } },
        select: { id: true, name: true, offeringId: true },
      }),

      // Questions that never got a chapter, so they belong to no shelf at all.
      prisma.question.groupBy({
        by: ["subjectId"],
        where: { isActive: true, chapterId: null },
        _count: { _all: true },
      }),
    ]);

    const questionsByOffering = new Map<number, number>();
    for (const c of chapterQuestionCounts) {
      questionsByOffering.set(c.offeringId, (questionsByOffering.get(c.offeringId) ?? 0) + c._count.questions);
    }

    // Known content defects, attributed to the offering that owns them.
    // Two single-pass grouped scans (questions, then options) rather than a
    // correlated subquery — see the 10-second ceiling note above.
    const [qDefects, oDefects] = await Promise.all([
      prisma.$queryRaw<Array<{ offeringId: number; omml: bigint; deadImg: bigint; mojibake: bigint }>>`
        SELECT o.id AS offeringId,
               SUM(q.text LIKE '%<m:%')        AS omml,
               SUM(q.text LIKE '%src="file:%') AS deadImg,
               SUM(q.text LIKE '%¦%')          AS mojibake
        FROM tq_questions q
        JOIN tq_chapters ch ON ch.id = q.chapterId
        JOIN tq_offerings o ON o.id = ch.offeringId
        WHERE q.isActive = 1
        GROUP BY o.id`,
      prisma.$queryRaw<Array<{ offeringId: number; omml: bigint; deadImg: bigint }>>`
        SELECT o.id AS offeringId,
               COUNT(DISTINCT CASE WHEN op.text LIKE '%<m:%'        THEN q.id END) AS omml,
               COUNT(DISTINCT CASE WHEN op.text LIKE '%src="file:%' THEN q.id END) AS deadImg
        FROM tq_question_options op
        JOIN tq_questions q  ON q.id  = op.questionId
        JOIN tq_chapters ch  ON ch.id = q.chapterId
        JOIN tq_offerings o  ON o.id  = ch.offeringId
        WHERE q.isActive = 1
        GROUP BY o.id`,
    ]);

    const defects = new Map<number, { unrenderableMath: number; deadImages: number; mojibake: number }>();
    const bump = (id: number, k: "unrenderableMath" | "deadImages" | "mojibake", n: number) => {
      if (n <= 0) return;
      const d = defects.get(id) ?? { unrenderableMath: 0, deadImages: 0, mojibake: 0 };
      d[k] += n;
      defects.set(id, d);
    };
    for (const r of qDefects) {
      bump(Number(r.offeringId), "unrenderableMath", Number(r.omml));
      bump(Number(r.offeringId), "deadImages", Number(r.deadImg));
      bump(Number(r.offeringId), "mojibake", Number(r.mojibake));
    }
    for (const r of oDefects) {
      bump(Number(r.offeringId), "unrenderableMath", Number(r.omml));
      bump(Number(r.offeringId), "deadImages", Number(r.deadImg));
    }

    // The gates and roll-up live in `@/lib/readiness` so they are unit-testable
    // in isolation and cannot drift from what the home page claims.
    const { summary, offerings: computed } = computeReadiness({
      offerings: offerings.map((o) => ({
        id: o.id,
        boardId: o.boardId,
        classId: o.classId,
        subjectId: o.subjectId,
        board: o.board,
        class: o.class,
        subject: o.subject,
        chapterCount: o._count.chapters,
        questionCount: questionsByOffering.get(o.id) ?? 0,
        testCount: o._count.tests,
        hasFreeSample: o.freeTest != null,
        videoCount: o._count.videos,
      })),
      plans: plans.map((p): PlanRow => ({
        boardId: p.boardId,
        classId: p.classId,
        durationMonths: p.durationMonths,
        price: Number(p.price),
        isActive: p.isActive,
      })),
    });

    const rows = computed.map((r) => ({ ...r, defects: defects.get(r.id) ?? null }));
    const offeringLabels = new Map(rows.map((r) => [r.id, r.label]));
    const subjectNames = new Map(offerings.map((o) => [o.subject.id, o.subject.name]));

    return success({
      summary,
      offerings: rows,
      tray: {
        noFreeSample: rows
          .filter((r) => !r.checks.freeSample.done)
          .map((r) => ({ offeringId: r.id, label: r.label })),
        noTests: rows
          .filter((r) => !r.checks.tests.done)
          .map((r) => ({ offeringId: r.id, label: r.label })),
        noChapters: rows
          .filter((r) => !r.checks.chapters.done)
          .map((r) => ({ offeringId: r.id, label: r.label })),
        emptyTests: emptyTests.map((t) => ({
          testId: t.id,
          name: t.name,
          offeringId: t.offeringId,
          label: offeringLabels.get(t.offeringId) ?? `Offering ${t.offeringId}`,
        })),
        untaggedQuestions: untaggedBySubject.map((g) => ({
          subjectId: g.subjectId,
          subjectName: subjectNames.get(g.subjectId) ?? `Subject ${g.subjectId}`,
          count: g._count._all,
        })),
        contentDefects: rows
          .filter((r) => r.defects)
          .map((r) => ({ offeringId: r.id, label: r.label, ...r.defects! })),
        missingPlans: [
          ...new Map(
            rows.filter((r) => !r.checks.plans.done)
              .map((r) => [`${r.board.id}:${r.class.id}`, {
                boardId: r.board.id, classId: r.class.id,
                label: `${r.board.name} · ${r.class.name}`,
                durations: r.planDurations,
              }]),
          ).values(),
        ],
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
