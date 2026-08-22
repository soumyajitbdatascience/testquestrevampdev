/**
 * Fixtures and teardown, done through Prisma rather than the UI.
 *
 * UI teardown only works when the test that created the row also finished
 * cleanly — which is precisely the case where cleanup does not matter. Deleting
 * directly means a mid-flow failure still leaves the database as it was found.
 *
 * Everything created carries the RUN_ID, so a crashed run's residue is
 * identifiable and a later run never collides with it.
 */
// The CJS copy generated for this suite — see the `e2eClient` generator in
// prisma/schema.prisma. The app's ESM client cannot be required by Playwright.
import { PrismaClient } from "../.prisma/client";

export const prisma = new PrismaClient();

/** Short, stable for one run, present in every name this suite writes. */
export const RUN_ID = process.env.E2E_RUN_ID ?? `E2E${Date.now().toString().slice(-6)}`;
export const tag = (s: string) => `${RUN_ID}-${s}`;
/** Matches anything this suite has ever created, across runs. */
const E2E_LIKE = "E2E%";

export interface Baseline {
  offerings: number; chapters: number; tests: number; questions: number;
  subjects: number; boards: number; coupons: number; students: number; orders: number;
}

export async function snapshot(): Promise<Baseline> {
  const [offerings, chapters, tests, questions, subjects, boards, coupons, students, orders] =
    await Promise.all([
      prisma.offering.count(), prisma.chapter.count(), prisma.test.count(),
      prisma.question.count(), prisma.subject.count(), prisma.board.count(),
      prisma.coupon.count(), prisma.student.count(), prisma.order.count(),
    ]);
  return { offerings, chapters, tests, questions, subjects, boards, coupons, students, orders };
}

/**
 * Removes only what this suite creates. Real seeded content — the 30 offerings,
 * 5,473 questions, the student rows and their orders — is never matched.
 */
export async function teardown(): Promise<string[]> {
  const removed: string[] = [];

  const tests = await prisma.test.findMany({ where: { name: { startsWith: "E2E" } }, select: { id: true } });
  if (tests.length) {
    const ids = tests.map((t) => t.id);
    await prisma.freeTest.deleteMany({ where: { testId: { in: ids } } });
    await prisma.testQuestion.deleteMany({ where: { testId: { in: ids } } });
    await prisma.attemptAnswer.deleteMany({ where: { attempt: { testId: { in: ids } } } });
    await prisma.attempt.deleteMany({ where: { testId: { in: ids } } });
    await prisma.test.deleteMany({ where: { id: { in: ids } } });
    removed.push(`${ids.length} test(s)`);
  }

  // Questions the editor spec creates, named with the run tag.
  const authored = await prisma.question.findMany({
    where: { text: { startsWith: "E2E" } }, select: { id: true },
  });
  if (authored.length) {
    const ids = authored.map((q) => q.id);
    await prisma.questionOption.deleteMany({ where: { questionId: { in: ids } } });
    await prisma.attemptAnswer.deleteMany({ where: { questionId: { in: ids } } });
    await prisma.testQuestion.deleteMany({ where: { questionId: { in: ids } } });
    await prisma.question.deleteMany({ where: { id: { in: ids } } });
    removed.push(`${ids.length} authored question(s)`);
  }

  const chapters = await prisma.chapter.findMany({ where: { name: { startsWith: "E2E" } }, select: { id: true } });
  if (chapters.length) {
    // Questions are real content: detach them, never delete them.
    await prisma.question.updateMany({ where: { chapterId: { in: chapters.map((c) => c.id) } }, data: { chapterId: null } });
    await prisma.chapter.deleteMany({ where: { id: { in: chapters.map((c) => c.id) } } });
    removed.push(`${chapters.length} chapter(s)`);
  }

  const offerings = await prisma.offering.findMany({
    where: { subject: { name: { startsWith: "E2E" } } }, select: { id: true },
  });
  if (offerings.length) {
    await prisma.freeTest.deleteMany({ where: { offeringId: { in: offerings.map((o) => o.id) } } });
    await prisma.test.deleteMany({ where: { offeringId: { in: offerings.map((o) => o.id) } } });
    await prisma.chapter.deleteMany({ where: { offeringId: { in: offerings.map((o) => o.id) } } });
    await prisma.offering.deleteMany({ where: { id: { in: offerings.map((o) => o.id) } } });
    removed.push(`${offerings.length} offering(s)`);
  }

  const c = await prisma.coupon.deleteMany({ where: { code: { startsWith: "E2E" } } });
  if (c.count) removed.push(`${c.count} coupon(s)`);
  const s = await prisma.subject.deleteMany({ where: { name: { startsWith: "E2E" } } });
  if (s.count) removed.push(`${s.count} subject(s)`);
  const b = await prisma.board.deleteMany({ where: { code: { startsWith: "E2E" } } });
  if (b.count) removed.push(`${b.count} board(s)`);
  const b2 = await prisma.board.deleteMany({ where: { name: { startsWith: "E2E" } } });
  if (b2.count) removed.push(`${b2.count} board(s) by name`);

  return removed;
}

/** A real offering with content, for tests that need one that already works. */
export async function pickPopulatedOffering() {
  return prisma.offering.findFirst({
    where: { isActive: true, chapters: { some: {} }, tests: { some: { isActive: true } } },
    select: {
      id: true, boardId: true, classId: true,
      board: { select: { name: true, code: true } },
      class: { select: { name: true } },
      subject: { select: { name: true } },
    },
    orderBy: { id: "asc" },
  });
}

export { E2E_LIKE };
