/**
 * Bulk reminder service — Task 5.3.2.
 *
 * Sends "assignment-reminder" broadcasts across many assignments in an org in a
 * single call. Mirrors the per-assignment logic in
 * /api/coaching/assignments/[id]/remind/route.ts but:
 *  - scoped by org + a time window ("all-active" = last 30d, "this-week" = 7d)
 *  - dedupes by mobile across the ENTIRE bulk run (a student in two batches
 *    won't get two messages in the same minute)
 *  - capped at 100 assignments per invocation to keep the synchronous call
 *    bounded — MVP volumes don't justify a background queue yet
 */
import { prisma } from "@/lib/db";
import { sendNotificationBroadcast } from "@/lib/notifications";

export type BulkReminderScope = "all-active" | "this-week";

export const BULK_REMINDER_ASSIGNMENT_CAP = 100;

export interface BulkReminderResult {
  assignmentsTargeted: number;
  studentsTargeted: number;
  sent: number;
  skipped: number;
  perAssignment: Array<{
    assignmentId: number;
    title: string | null;
    targeted: number;
    sent: number;
  }>;
}

export interface BulkReminderArgs {
  orgId: number;
  actingUserId: number;
  scope: BulkReminderScope;
}

export class BulkReminderTooManyError extends Error {
  constructor(public readonly count: number) {
    super(
      `Too many assignments in scope (${count}). Narrow the window or run per-batch reminders.`,
    );
    this.name = "BulkReminderTooManyError";
  }
}

function scopeSinceDate(scope: BulkReminderScope): Date {
  const now = Date.now();
  const days = scope === "all-active" ? 30 : 7;
  return new Date(now - days * 24 * 60 * 60 * 1000);
}

export async function previewBulkReminders(
  args: Omit<BulkReminderArgs, "actingUserId">,
): Promise<{ assignmentsTargeted: number; studentsTargeted: number }> {
  const since = scopeSinceDate(args.scope);
  const assignments = await prisma.assignment.findMany({
    where: { orgId: args.orgId, isActive: true, createdAt: { gte: since } },
    select: { id: true, batchId: true },
  });
  if (assignments.length === 0) {
    return { assignmentsTargeted: 0, studentsTargeted: 0 };
  }
  const assignmentIds = assignments.map((a) => a.id);
  const batchIds = Array.from(new Set(assignments.map((a) => a.batchId)));

  const [enrollments, started] = await Promise.all([
    prisma.batchEnrollment.findMany({
      where: { batchId: { in: batchIds }, isActive: true },
      select: { batchId: true, studentId: true },
    }),
    prisma.assignmentAttempt.findMany({
      where: { assignmentId: { in: assignmentIds } },
      select: { assignmentId: true, studentId: true },
    }),
  ]);

  const enrollByBatch = new Map<number, number[]>();
  for (const e of enrollments) {
    const list = enrollByBatch.get(e.batchId) ?? [];
    list.push(e.studentId);
    enrollByBatch.set(e.batchId, list);
  }
  const startedByAssignment = new Map<number, Set<number>>();
  for (const s of started) {
    const set = startedByAssignment.get(s.assignmentId) ?? new Set<number>();
    set.add(s.studentId);
    startedByAssignment.set(s.assignmentId, set);
  }

  let assignmentsTargeted = 0;
  const uniqueStudents = new Set<number>();
  for (const a of assignments) {
    const enrolled = enrollByBatch.get(a.batchId) ?? [];
    const startedSet = startedByAssignment.get(a.id) ?? new Set<number>();
    const notStarted = enrolled.filter((sid) => !startedSet.has(sid));
    if (notStarted.length > 0) {
      assignmentsTargeted++;
      for (const sid of notStarted) uniqueStudents.add(sid);
    }
  }
  return { assignmentsTargeted, studentsTargeted: uniqueStudents.size };
}

export async function sendBulkReminders(
  args: BulkReminderArgs,
): Promise<BulkReminderResult> {
  const since = scopeSinceDate(args.scope);

  const assignments = await prisma.assignment.findMany({
    where: { orgId: args.orgId, isActive: true, createdAt: { gte: since } },
    include: { org: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  if (assignments.length > BULK_REMINDER_ASSIGNMENT_CAP) {
    throw new BulkReminderTooManyError(assignments.length);
  }

  if (assignments.length === 0) {
    return {
      assignmentsTargeted: 0,
      studentsTargeted: 0,
      sent: 0,
      skipped: 0,
      perAssignment: [],
    };
  }

  const assignmentIds = assignments.map((a) => a.id);
  const batchIds = Array.from(new Set(assignments.map((a) => a.batchId)));

  const [enrollments, started] = await Promise.all([
    prisma.batchEnrollment.findMany({
      where: { batchId: { in: batchIds }, isActive: true },
      select: { batchId: true, studentId: true },
    }),
    prisma.assignmentAttempt.findMany({
      where: { assignmentId: { in: assignmentIds } },
      select: { assignmentId: true, studentId: true },
    }),
  ]);

  const enrollByBatch = new Map<number, number[]>();
  for (const e of enrollments) {
    const list = enrollByBatch.get(e.batchId) ?? [];
    list.push(e.studentId);
    enrollByBatch.set(e.batchId, list);
  }
  const startedByAssignment = new Map<number, Set<number>>();
  for (const s of started) {
    const set = startedByAssignment.get(s.assignmentId) ?? new Set<number>();
    set.add(s.studentId);
    startedByAssignment.set(s.assignmentId, set);
  }

  // Resolve all not-started student mobiles in a single query.
  const allNeededStudentIds = new Set<number>();
  for (const a of assignments) {
    const enrolled = enrollByBatch.get(a.batchId) ?? [];
    const startedSet = startedByAssignment.get(a.id) ?? new Set<number>();
    for (const sid of enrolled) if (!startedSet.has(sid)) allNeededStudentIds.add(sid);
  }

  const mobileByStudent = new Map<number, string>();
  if (allNeededStudentIds.size > 0) {
    const ids = Array.from(allNeededStudentIds);
    const rows = await prisma.$queryRawUnsafe<
      Array<{ id: number; mobile: string | null }>
    >(
      `SELECT id, mobile FROM vw_students WHERE id IN (${ids.map(() => "?").join(",")})`,
      ...ids,
    );
    for (const r of rows) {
      const m = (r.mobile ?? "").replace(/\D+/g, "");
      if (m.length >= 10) mobileByStudent.set(Number(r.id), m);
    }
  }

  const result: BulkReminderResult = {
    assignmentsTargeted: 0,
    studentsTargeted: 0,
    sent: 0,
    skipped: 0,
    perAssignment: [],
  };
  // Global dedupe — once a mobile has been messaged in this run, don't message
  // it again even if a different assignment also has that student behind.
  const globalSeenMobiles = new Set<string>();
  const globalStudentsTouched = new Set<number>();

  // Build a flat send-plan up front so dedupe (by mobile) and per-assignment
  // accounting are deterministic before we fan out. Each entry corresponds to
  // exactly one notification call that will actually go out.
  type Send = {
    assignmentIndex: number;
    mobile: string;
    orgName: string;
    title: string;
    dueText: string | undefined;
    link: string;
  };
  const sends: Send[] = [];
  const perAssignmentSent: number[] = new Array(assignments.length).fill(0);

  for (let i = 0; i < assignments.length; i++) {
    const a = assignments[i];
    const enrolled = enrollByBatch.get(a.batchId) ?? [];
    const startedSet = startedByAssignment.get(a.id) ?? new Set<number>();
    const notStarted = enrolled.filter((sid) => !startedSet.has(sid));
    if (notStarted.length === 0) continue;

    result.assignmentsTargeted++;
    const orgName = a.org?.name ?? "your centre";
    const link = `/coaching/assignments/${a.id}`;
    const dueText = a.dueAt
      ? `Due ${a.dueAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
      : undefined;

    for (const sid of notStarted) {
      globalStudentsTouched.add(sid);
      const mobile = mobileByStudent.get(sid);
      if (!mobile) {
        result.skipped++;
        continue;
      }
      if (globalSeenMobiles.has(mobile)) {
        result.skipped++;
        continue;
      }
      globalSeenMobiles.add(mobile);
      sends.push({
        assignmentIndex: i,
        mobile,
        orgName,
        title: a.title ?? "test",
        dueText,
        link,
      });
    }
  }

  // Concurrency cap for the outbound notification calls. Each send is a cheap
  // WhatsApp/SMS HTTP fan-out (much lighter than the weekly-report PDF render),
  // so 10 in flight stays comfortably under provider rate limits while
  // collapsing 3000 sequential awaits into ~300 round-trip cycles.
  const NOTIFY_CONCURRENCY = 10;

  for (let i = 0; i < sends.length; i += NOTIFY_CONCURRENCY) {
    const chunk = sends.slice(i, i + NOTIFY_CONCURRENCY);
    const settled = await Promise.allSettled(
      chunk.map((s) =>
        sendNotificationBroadcast({
          template: "assignment-reminder",
          params: { orgName: s.orgName, testName: s.title, dueText: s.dueText, link: s.link },
          recipient: { mobile: s.mobile },
          channels: ["whatsapp", "sms"],
        }),
      ),
    );
    for (let j = 0; j < settled.length; j++) {
      const r = settled[j];
      const s = chunk[j];
      if (r.status === "fulfilled" && r.value.delivered > 0) {
        result.sent++;
        perAssignmentSent[s.assignmentIndex]++;
      } else {
        result.skipped++;
      }
    }
  }

  for (let i = 0; i < assignments.length; i++) {
    const a = assignments[i];
    const enrolled = enrollByBatch.get(a.batchId) ?? [];
    const startedSet = startedByAssignment.get(a.id) ?? new Set<number>();
    const notStarted = enrolled.filter((sid) => !startedSet.has(sid));
    if (notStarted.length === 0) continue;
    result.perAssignment.push({
      assignmentId: a.id,
      title: a.title ?? null,
      targeted: notStarted.length,
      sent: perAssignmentSent[i],
    });
  }

  result.studentsTargeted = globalStudentsTouched.size;
  return result;
}
