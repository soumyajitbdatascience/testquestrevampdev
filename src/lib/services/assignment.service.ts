/**
 * Assignment service — Task 1.8.
 *
 * Owner picks a test from vw_tests and assigns it to a batch. We create the
 * tq_assignments row, then synchronously fan out notifications (SMS + email)
 * to every active enrolled student. Notifications go through the stub helpers
 * in lib/sms.ts and lib/email.ts; both are no-ops in production until real
 * providers land.
 *
 * Race semantics (per spec): re-assigning the same test to the same batch
 * intentionally creates a second row. This is the owner's prerogative — they
 * may want to re-issue a retake.
 */
import { prisma } from "@/lib/db";
import { sendNotificationBroadcast, type Channel } from "@/lib/notifications";
import { buildEmailBranding } from "@/lib/branding-for-email";
import type { Prisma } from "@/generated/prisma/client";

export type NotifyChannel = "sms" | "email";

export interface CreateAssignmentInput {
  orgId: number;
  batchId: number;
  testId: number;
  /** Owner's free-text title. Defaults to the legacy test name when omitted. */
  title?: string | null;
  instructions?: string | null;
  dueAt?: Date | null;
  notify: NotifyChannel[];
  assignedBy: number;
}

export interface AssignmentNotificationStats {
  sms:   { sent: number; skipped: number };
  email: { sent: number; skipped: number };
}

export interface CreateAssignmentResult {
  assignmentId: number;
  enrolledCount: number;
  notifications: AssignmentNotificationStats;
}

async function getTestMeta(testId: number) {
  const rows = await prisma.$queryRaw<Array<{ id: number; name: string }>>`
    SELECT id, name FROM vw_tests WHERE id = ${testId} LIMIT 1
  `;
  return rows[0] ?? null;
}

async function getOrgName(orgId: number): Promise<string> {
  const r = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });
  return r?.name ?? "your centre";
}

export async function createAssignment(input: CreateAssignmentInput): Promise<CreateAssignmentResult> {
  // 1. Validate test exists in vw_tests (soft ref, no FK).
  const test = await getTestMeta(input.testId);
  if (!test) throw new Error(`Test ${input.testId} not found`);

  // 2. Validate batch + org match (defence in depth — the route already
  //    checks requireOrgRole, but we want to fail closed here too).
  const batch = await prisma.batch.findUnique({
    where: { id: input.batchId },
    select: { orgId: true, name: true },
  });
  if (!batch || batch.orgId !== input.orgId) throw new Error("Batch not found");

  // 3. Persist.
  const settingsJson = { notify: input.notify } satisfies Record<string, unknown>;
  const assignment = await prisma.assignment.create({
    data: {
      orgId: input.orgId,
      batchId: input.batchId,
      testId: input.testId,
      title: input.title ?? test.name,
      instructions: input.instructions ?? null,
      dueAt: input.dueAt ?? null,
      assignedBy: input.assignedBy,
      settingsJson: settingsJson as unknown as Prisma.InputJsonValue,
    },
  });

  // 4. Notify enrolled students.
  const enrollments = await prisma.batchEnrollment.findMany({
    where: { batchId: input.batchId, isActive: true },
    select: { studentId: true },
  });
  const studentIds = enrollments.map((e) => e.studentId);
  const stats: AssignmentNotificationStats = {
    sms:   { sent: 0, skipped: 0 },
    email: { sent: 0, skipped: 0 },
  };
  if (studentIds.length > 0) {
    const orgName = await getOrgName(input.orgId);
    const placeholders = studentIds.map(() => "?").join(",");
    const students = await prisma.$queryRawUnsafe<Array<{
      id: number; name: string; mobile: string | null; email: string;
    }>>(
      `SELECT id, name, mobile, email FROM vw_students WHERE id IN (${placeholders})`,
      ...studentIds,
    );

    const link = `/coaching/assignments/${assignment.id}`;
    const dueText = input.dueAt
      ? `Due ${input.dueAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
      : undefined;

    // Phase 2 / Task 2.6 — channel selection via the notification dispatcher.
    // The owner's picked channels (sms/email) determine which providers the
    // dispatcher fans out to; the template's eligibleChannels acts as a guard.
    const requestedChannels: Channel[] = input.notify as Channel[];
    // One branding lookup per assignment burst — same orgId for every student.
    const branding = await buildEmailBranding(input.orgId);

    for (const s of students) {
      const result = await sendNotificationBroadcast({
        template: "assignment-new",
        params: { orgName, testName: test.name, dueText, link },
        recipient: { mobile: s.mobile, email: s.email, branding },
        channels: requestedChannels,
      });
      // Project per-channel results back into the `stats` shape the route
      // handler returns to the assign-test UI. Results are returned in the
      // same order as `requestedChannels` (one entry per requested channel).
      requestedChannels.forEach((channel, i) => {
        const r = result.results[i];
        const ok = r?.delivered === true;
        if (channel === "sms")        ok ? stats.sms.sent++   : stats.sms.skipped++;
        else if (channel === "email") ok ? stats.email.sent++ : stats.email.skipped++;
      });
    }
  }

  return {
    assignmentId: assignment.id,
    enrolledCount: studentIds.length,
    notifications: stats,
  };
}

/**
 * Server-side test search for the assign-test picker.
 * Scopes results to the batch's class. Subject filter is optional (when
 * provided, restricts to vw_subjects.name IN the chosen list — case sensitive
 * since legacy names are mixed-case).
 */
export interface PickerTest {
  id: number;
  name: string;
  classId: number | null;
  className: string | null;
  subjectId: number | null;
  subjectName: string | null;
  durationMinutes: number;
  totalMarks: number;
  questionCount: number;
  isFree: boolean;
  isPractice: boolean;
}

export async function searchTestsForPicker(opts: {
  classId: number;
  /**
   * The org calling the picker. We exclude tests private to OTHER orgs but
   * include public Testquest tests AND tests this org authored.
   */
  orgId: number;
  subjects?: string[];
  q?: string;
  limit?: number;
}): Promise<PickerTest[]> {
  const limit = Math.min(60, Math.max(1, opts.limit ?? 40));
  const filters: string[] = ["t.isActive = TRUE", "t.classId = ?"];
  const args: (string | number)[] = [opts.classId];

  if (opts.subjects && opts.subjects.length > 0) {
    filters.push(`s.name IN (${opts.subjects.map(() => "?").join(",")})`);
    args.push(...opts.subjects);
  }
  if (opts.q && opts.q.trim().length > 0) {
    filters.push("t.name LIKE ?");
    args.push(`%${opts.q.trim()}%`);
  }
  // Org scoping (Phase 2 / Task 2.2): exclude tests private to other orgs.
  filters.push(
    "NOT EXISTS (SELECT 1 FROM tq_org_tests ot WHERE ot.legacyTestId = t.id AND ot.isActive = TRUE AND ot.orgId <> ?)",
  );
  args.push(opts.orgId);

  const rows = await prisma.$queryRawUnsafe<Array<{
    id: number; name: string; classId: number | null; className: string | null;
    subjectId: number | null; subjectName: string | null;
    durationMinutes: number; totalMarks: number; isFree: number | boolean; isPractice: number | boolean;
    questionCount: bigint;
  }>>(
    // totalMarks is the SUM of per-question marks for this test (vw_tests
    // doesn't expose totalMarks directly). NULL when the test has 0 questions
    // so the API caller can coalesce to 0 client-side.
    `SELECT t.id, t.name,
            t.classId, c.name AS className,
            t.subjectId, s.name AS subjectName,
            t.durationMinutes,
            COALESCE((SELECT SUM(q.marks) FROM vw_test_questions q WHERE q.testId = t.id), 0) AS totalMarks,
            t.isFree, t.isPractice,
            (SELECT COUNT(*) FROM vw_test_questions q WHERE q.testId = t.id) AS questionCount
     FROM vw_tests t
     LEFT JOIN vw_classes c ON c.id = t.classId
     LEFT JOIN vw_subjects s ON s.id = t.subjectId
     WHERE ${filters.join(" AND ")}
     ORDER BY t.name
     LIMIT ${limit}`,
    ...args,
  );

  return rows.map((r) => ({
    id: Number(r.id),
    name: r.name,
    classId: r.classId !== null ? Number(r.classId) : null,
    className: r.className,
    subjectId: r.subjectId !== null ? Number(r.subjectId) : null,
    subjectName: r.subjectName,
    durationMinutes: Number(r.durationMinutes ?? 0),
    totalMarks: Number(r.totalMarks ?? 0),
    questionCount: Number(r.questionCount ?? 0),
    isFree: !!r.isFree,
    isPractice: !!r.isPractice,
  }));
}
