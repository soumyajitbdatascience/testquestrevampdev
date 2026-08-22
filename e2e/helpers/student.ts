/**
 * Student fixtures for the B2C suite.
 *
 * Students are created through Prisma rather than the signup API so a run
 * never depends on outbound mail (verification) being configured, and so the
 * "zero contexts" starting state is exact rather than assumed.
 *
 * Every row is addressable by the E2E email domain, which is what teardown
 * matches — real students can never be caught by it.
 */
import bcrypt from "bcryptjs";
import { prisma, RUN_ID } from "./db";

export const E2E_EMAIL_DOMAIN = "e2e.testquest.test";
export const STUDENT_PASSWORD = "e2e-student-pw-1";

export function studentEmail(slug: string): string {
  return `${RUN_ID}-${slug}@${E2E_EMAIL_DOMAIN}`.toLowerCase();
}

/** A student with **no** contexts — the only state that may see onboarding. */
export async function createFreshStudent(slug: string) {
  const email = studentEmail(slug);
  await prisma.student.deleteMany({ where: { email } });
  return prisma.student.create({
    data: {
      name: `E2E Student ${slug}`,
      email,
      passwordHash: await bcrypt.hash(STUDENT_PASSWORD, 10),
      emailVerified: true,
      isActive: true,
    },
    select: { id: true, email: true, name: true },
  });
}

/**
 * Two distinct board+class scopes that both have published content, so a
 * cross-class assertion has something real on each side. Returns null when the
 * database has fewer than two populated classes — the caller skips rather than
 * asserting on an empty set, which would pass for the wrong reason.
 */
export async function pickTwoPopulatedScopes() {
  const offerings = await prisma.offering.findMany({
    where: { isActive: true, tests: { some: { isActive: true } } },
    select: {
      boardId: true, classId: true,
      board: { select: { name: true, code: true } },
      class: { select: { name: true } },
    },
    orderBy: { id: "asc" },
  });

  const seen = new Map<string, (typeof offerings)[number]>();
  for (const o of offerings) {
    const k = `${o.boardId}:${o.classId}`;
    if (!seen.has(k)) seen.set(k, o);
  }
  const scopes = [...seen.values()];
  if (scopes.length < 2) return null;
  return { a: scopes[0], b: scopes[1] };
}

/** Remove every student this suite created, and everything hanging off them. */
export async function teardownStudents(): Promise<string[]> {
  const students = await prisma.student.findMany({
    where: { email: { endsWith: `@${E2E_EMAIL_DOMAIN}` } },
    select: { id: true },
  });
  if (students.length === 0) return [];
  const ids = students.map((s) => s.id);

  await prisma.attemptAnswer.deleteMany({ where: { attempt: { studentId: { in: ids } } } });
  await prisma.attempt.deleteMany({ where: { studentId: { in: ids } } });
  await prisma.classAccess.deleteMany({ where: { studentId: { in: ids } } });
  await prisma.order.deleteMany({ where: { studentId: { in: ids } } });
  // Contexts cascade with the student, but delete explicitly so a failed
  // cascade shows up here rather than as a mystery FK error.
  await prisma.studentContext.deleteMany({ where: { studentId: { in: ids } } });
  await prisma.student.deleteMany({ where: { id: { in: ids } } });

  return [`${ids.length} e2e student(s)`];
}

/**
 * Gives a student a paid pass on a board+class, plus the order behind it.
 *
 * `finalAmountPaise` is written in **paise**, as a real order is — that is the
 * point: it lets a test assert the display divides exactly once. A ₹1,000 pass
 * is 100000 here, must render "₹1000", and must never render "₹10".
 */
export async function grantPaidPass(
  studentId: number,
  boardId: number,
  classId: number,
  finalAmountPaise: number,
) {
  const plan = await prisma.b2cPlan.findFirst({
    where: { boardId, classId, subjectId: null, isActive: true },
    orderBy: { price: "asc" },
    select: { id: true },
  });
  const order = await prisma.order.create({
    data: {
      studentId, itemType: "B2C_PLAN", planId: plan?.id ?? null,
      boardId, classId,
      amount: finalAmountPaise, discount: 0, finalAmount: finalAmountPaise,
      status: "PAID", razorpayPaymentId: `pay_${RUN_ID}`,
    },
    select: { id: true },
  });
  const now = new Date();
  await prisma.classAccess.create({
    data: {
      studentId, boardId, classId,
      startsAt: now, expiresAt: new Date(now.getTime() + 90 * 86400e3),
      orderId: order.id, planId: plan?.id ?? null,
    },
  });
  return order.id;
}

/** A board+class that actually has an active video, or null. */
export async function findScopeWithVideo() {
  const video = await prisma.video.findFirst({
    where: { isActive: true, offering: { isActive: true } },
    select: {
      id: true,
      offering: { select: { id: true, boardId: true, classId: true, subject: { select: { name: true } } } },
    },
    orderBy: { id: "asc" },
  });
  return video ? { videoId: video.id, ...video.offering } : null;
}
