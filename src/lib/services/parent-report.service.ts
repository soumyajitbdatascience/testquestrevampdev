/**
 * Parent-report service — Task 3.1.
 *
 * Compiles a per-student snapshot over the last 4 weeks and renders it to a
 * PDF using `@react-pdf/renderer`. The caller (the generate endpoint) is
 * responsible for org-role auth and for writing the buffer to disk; this
 * module is pure-ish: it only reads from the DB and produces the buffer.
 *
 * Data sources (per the ticket):
 *  - vw_students                 — student name + class
 *  - tq_batches                  — batch name + class
 *  - tq_batch_enrollments        — peer set for batch-average comparison
 *  - tq_assignments              — assigned tests, for the attendance proxy
 *  - vw_attempts_legacy          — finished attempts (status=2) with %
 *  - vw_test_questions / vw_questions — per-question subject + difficulty,
 *                                  used to bucket weak topics
 *  - main_exam_result            — per-question correct/wrong breakdown
 *
 * Performance notes: Hostinger caps statement time at 10s. We avoid any
 * correlated subqueries per row and stick to bulk reads + in-memory rollups.
 */
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import {
  ParentReportDoc,
  type TrendPoint,
  type WeakTopic,
  type PdfBranding,
} from "@/lib/parent-report/report-doc";
import { isWhiteLabelAllowed, readBranding } from "@/lib/services/branding.service";

const WINDOW_DAYS = 28;
const WEAK_TOPIC_THRESHOLD = 60; // accuracy % below this is "weak"
const MAX_WEAK_TOPICS = 6;

// ─── Public types ──────────────────────────────────────────────────

export interface BuildParentReportInput {
  orgId: number;
  studentId: number;
  batchId: number;
}

export interface ParentReportSummary {
  studentName: string;
  batchName: string;
  attemptsCount: number;
  averagePct: number;
  attendancePct: number;
  assignedCount: number;
  completedCount: number;
  batchAveragePct: number;
  batchSize: number;
  trend: TrendPoint[];
  weakTopics: WeakTopic[];
  periodStart: string; // ISO
  periodEnd: string;   // ISO
}

export interface BuildParentReportResult {
  pdfBuffer: Buffer;
  summary: ParentReportSummary;
  filename: string;
  /** True when the student has zero finished attempts in the window — the
   *  caller should refuse to generate the PDF and return a friendly error. */
  empty: boolean;
}

// ─── Internal row shapes ───────────────────────────────────────────

interface AttemptRow {
  attemptId: number;
  studentId: number;
  testId: number;
  score: number;
  totalMarks: number;
  percentage: number;
  finishedAt: Date;
  token: string;
}

interface PerQuestionRow {
  // per row of main_exam_result restricted to the student's finished attempts
  studentId: number;
  questionId: number;
  result: number; // 0 unanswered, 1 correct, 2 wrong
  subjectId: number | null;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  subjectName: string;
}

// ─── DB helpers ────────────────────────────────────────────────────

async function loadStudent(studentId: number) {
  const rows = await prisma.$queryRaw<Array<{ id: number | bigint; name: string; classId: number | bigint | null }>>`
    SELECT id, name, classId FROM vw_students WHERE id = ${studentId} LIMIT 1
  `;
  if (!rows[0]) return null;
  return {
    id: Number(rows[0].id),
    name: rows[0].name,
    classId: rows[0].classId !== null ? Number(rows[0].classId) : null,
  };
}

async function loadClassName(classId: number | null): Promise<string | null> {
  if (!classId) return null;
  const rows = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT name FROM vw_classes WHERE id = ${classId} LIMIT 1
  `;
  return rows[0]?.name ?? null;
}

/** All finished (status=2) main + practice attempts in the window for the
 *  given student set. We bulk-load for both the student under report and
 *  their batch peers in a single query, then split in-memory. */
async function loadFinishedAttempts(studentIds: number[], since: Date): Promise<AttemptRow[]> {
  if (studentIds.length === 0) return [];
  const placeholders = studentIds.map(() => "?").join(",");
  const rows = await prisma.$queryRawUnsafe<Array<{
    id: number | bigint; studentId: number; testId: number | bigint;
    score: string | number | null; totalMarks: string | number | null;
    percentage: string | number | null; finishedAt: Date | null; token: string;
  }>>(
    `SELECT id, studentId, testId, score, totalMarks, percentage, finishedAt, token
     FROM vw_attempts_legacy
     WHERE status = 2
       AND studentId IN (${placeholders})
       AND finishedAt IS NOT NULL
       AND finishedAt >= ?
     ORDER BY finishedAt ASC
     LIMIT 2000`,
    ...studentIds, since,
  );
  return rows.map((r) => ({
    attemptId: Number(r.id),
    studentId: Number(r.studentId),
    testId: Number(r.testId),
    score: Number(r.score ?? 0),
    totalMarks: Number(r.totalMarks ?? 0),
    percentage: Number(r.percentage ?? 0),
    finishedAt: r.finishedAt as Date,
    token: r.token,
  }));
}

/**
 * Per-question breakdown for the student's finished attempts. We join the
 * legacy result rows by token to vw_questions for subject + difficulty, and
 * to vw_subjects for the human-readable subject name. Limited to the
 * student under report to keep the query cheap.
 */
async function loadStudentResultsBreakdown(tokens: string[]): Promise<PerQuestionRow[]> {
  if (tokens.length === 0) return [];
  const placeholders = tokens.map(() => "?").join(",");
  const rows = await prisma.$queryRawUnsafe<Array<{
    studentId: number; questionId: number; result: number | null;
    subjectId: number | bigint | null; difficulty: string;
    subjectName: string | null;
  }>>(
    // We can't join the practice_exam_result table from the same SELECT
    // cheaply; vw_attempts_legacy already covers practice via UNION, but
    // for the weak-topic breakdown we lean on main_exam_result + UNION ALL
    // practice_exam_result so we pick up both kinds of attempts.
    `SELECT r.student_id AS studentId, r.question_id AS questionId, r.result AS result,
            q.subjectId AS subjectId, q.difficulty AS difficulty,
            s.name AS subjectName
       FROM (
         SELECT student_id, question_id, result, token FROM main_exam_result
         WHERE token IN (${placeholders})
         UNION ALL
         SELECT student_id, question_id, result, token FROM practice_exam_result
         WHERE token IN (${placeholders})
       ) r
       LEFT JOIN vw_questions q ON q.id = r.question_id
       LEFT JOIN vw_subjects  s ON s.id = q.subjectId
      LIMIT 5000`,
    ...tokens, ...tokens,
  );
  return rows.map((r) => ({
    studentId: Number(r.studentId),
    questionId: Number(r.questionId),
    result: Number(r.result ?? 0),
    subjectId: r.subjectId !== null ? Number(r.subjectId) : null,
    difficulty:
      r.difficulty === "EASY" || r.difficulty === "HARD" ? r.difficulty as "EASY" | "HARD"
      : "MEDIUM",
    subjectName: r.subjectName ?? "Unknown",
  }));
}

/** Active enrolled student ids for the batch. */
async function loadBatchPeers(batchId: number): Promise<number[]> {
  const rows = await prisma.batchEnrollment.findMany({
    where: { batchId, isActive: true },
    select: { studentId: true },
  });
  return rows.map((r) => r.studentId);
}

// ─── Rollup helpers ────────────────────────────────────────────────

interface WeeklyBucket {
  start: Date;
  label: string;
  pctSum: number;
  count: number;
}

function buildWeekBuckets(now: Date): WeeklyBucket[] {
  // Four buckets ending today, oldest first.
  const buckets: WeeklyBucket[] = [];
  for (let i = 3; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(start.getDate() - (i + 1) * 7 + 1);
    start.setHours(0, 0, 0, 0);
    const label = start.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    buckets.push({ start, label, pctSum: 0, count: 0 });
  }
  return buckets;
}

function pushIntoBucket(buckets: WeeklyBucket[], finishedAt: Date, pct: number) {
  for (let i = buckets.length - 1; i >= 0; i--) {
    if (finishedAt >= buckets[i].start) {
      buckets[i].pctSum += pct;
      buckets[i].count += 1;
      return;
    }
  }
}

function bucketsToTrend(buckets: WeeklyBucket[]): TrendPoint[] {
  return buckets.map((b) => ({
    label: b.label,
    pct: b.count === 0 ? null : Math.round(b.pctSum / b.count),
  }));
}

/**
 * Bucket per-question rows by (subjectName, difficulty), compute accuracy,
 * keep buckets with at least 3 attempted questions AND accuracy below the
 * threshold, sort lowest-accuracy first.
 */
function rollupWeakTopics(rows: PerQuestionRow[]): WeakTopic[] {
  const map = new Map<string, { subject: string; difficulty: "EASY" | "MEDIUM" | "HARD"; attempted: number; correct: number }>();
  for (const r of rows) {
    if (r.result !== 1 && r.result !== 2) continue; // skip unanswered
    const key = `${r.subjectName}::${r.difficulty}`;
    const cur = map.get(key) ?? { subject: r.subjectName, difficulty: r.difficulty, attempted: 0, correct: 0 };
    cur.attempted += 1;
    if (r.result === 1) cur.correct += 1;
    map.set(key, cur);
  }
  const all: WeakTopic[] = [...map.values()]
    .filter((b) => b.attempted >= 3)
    .map((b) => ({
      subject: b.subject,
      difficulty: b.difficulty,
      attempted: b.attempted,
      accuracyPct: Math.round((b.correct / b.attempted) * 100),
    }));
  return all
    .filter((b) => b.accuracyPct < WEAK_TOPIC_THRESHOLD)
    .sort((a, b) => a.accuracyPct - b.accuracyPct)
    .slice(0, MAX_WEAK_TOPICS);
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// ─── Main entry point ──────────────────────────────────────────────

export async function buildParentReport(input: BuildParentReportInput): Promise<BuildParentReportResult> {
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - WINDOW_DAYS);

  // 1. Validate batch belongs to org and the student is enrolled.
  const batch = await prisma.batch.findUnique({
    where: { id: input.batchId },
    select: { id: true, orgId: true, name: true, classId: true },
  });
  if (!batch || batch.orgId !== input.orgId) throw new Error("Batch not found");

  const enrolled = await prisma.batchEnrollment.findFirst({
    where: { batchId: input.batchId, studentId: input.studentId, isActive: true },
    select: { id: true },
  });
  if (!enrolled) throw new Error("Student not enrolled in this batch");

  const student = await loadStudent(input.studentId);
  if (!student) throw new Error("Student not found");

  const [org, className, peerIds] = await Promise.all([
    prisma.organization.findUnique({ where: { id: input.orgId }, select: { name: true } }),
    loadClassName(batch.classId ?? null),
    loadBatchPeers(input.batchId),
  ]);
  const orgName = org?.name ?? "Your centre";

  // Branding (Task 3.6). Plan-gated; B2C / Starter orgs get undefined →
  // doc falls back to the default Testquest palette + wordmark.
  let pdfBranding: PdfBranding | undefined = undefined;
  if (await isWhiteLabelAllowed(input.orgId)) {
    const wl = await readBranding(input.orgId);
    const empty = (s: string | undefined) => (s && s.length > 0 ? s : undefined);
    const logo = empty(wl.logoLightUrl) ?? empty(wl.logoDarkUrl);
    const primary = empty(wl.primaryColor);
    const display = empty(wl.displayName);
    const supEmail = empty(wl.supportEmail);
    const supPhone = empty(wl.supportPhone);
    // Only build the object when at least one branding field is set, so the
    // PDF stays on the default palette when an org enables white-label but
    // hasn't actually configured anything yet.
    if (logo || primary || display || supEmail || supPhone) {
      pdfBranding = {
        orgDisplayName: display,
        logoUrl: logo,
        primaryColor: primary,
        supportEmail: supEmail,
        supportPhone: supPhone,
      };
    }
  }

  // 2. Bulk-load all finished attempts in the window for student + peers.
  const allIds = Array.from(new Set([input.studentId, ...peerIds]));
  const allAttempts = await loadFinishedAttempts(allIds, since);
  const studentAttempts = allAttempts.filter((a) => a.studentId === input.studentId);
  const peerAttempts    = allAttempts.filter((a) => a.studentId !== input.studentId);

  // 3. Attendance proxy: % of recent batch assignments where the student
  //    has at least one completed attempt of the assigned test.
  const recentAssignments = await prisma.assignment.findMany({
    where: { batchId: input.batchId, isActive: true, createdAt: { gte: since } },
    select: { id: true, testId: true },
  });
  const assignedCount = recentAssignments.length;
  const completedTestIds = new Set(studentAttempts.map((a) => a.testId));
  const completedCount = recentAssignments.filter((a) => completedTestIds.has(a.testId)).length;
  const attendancePct = assignedCount === 0 ? 0 : (completedCount / assignedCount) * 100;

  // 4. Empty-data guard. The caller maps this to a 400 with a friendly message.
  if (studentAttempts.length === 0) {
    const filename = `parent-report-${input.studentId}-empty.pdf`;
    return {
      pdfBuffer: Buffer.alloc(0),
      summary: {
        studentName: student.name,
        batchName: batch.name,
        attemptsCount: 0,
        averagePct: 0,
        attendancePct,
        assignedCount,
        completedCount,
        batchAveragePct: average(peerAttempts.map((a) => a.percentage)),
        batchSize: peerIds.length,
        trend: bucketsToTrend(buildWeekBuckets(now)),
        weakTopics: [],
        periodStart: since.toISOString(),
        periodEnd:   now.toISOString(),
      },
      filename,
      empty: true,
    };
  }

  // 5. Roll up.
  const buckets = buildWeekBuckets(now);
  for (const a of studentAttempts) pushIntoBucket(buckets, a.finishedAt, a.percentage);
  const trend = bucketsToTrend(buckets);
  const averagePct = average(studentAttempts.map((a) => a.percentage));

  // 6. Batch average: all peers (excluding the student under report) over
  //    the same window. If the batch only has the one student, fall back to
  //    that same average so the comparison row is meaningful.
  const batchAveragePct = peerAttempts.length > 0
    ? average(peerAttempts.map((a) => a.percentage))
    : averagePct;

  // 7. Weak topics from per-question breakdown.
  const breakdown = await loadStudentResultsBreakdown(studentAttempts.map((a) => a.token));
  const weakTopics = rollupWeakTopics(breakdown);

  // 8. Render.
  const periodLabel = `${since.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${now.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;

  const docEl = React.createElement(ParentReportDoc, {
    orgName,
    studentName: student.name,
    batchName: batch.name,
    className,
    periodLabel,
    generatedAt: now,
    attemptsCount: studentAttempts.length,
    averagePct,
    attendancePct,
    assignedCount,
    completedCount,
    trend,
    weakTopics,
    batchAveragePct,
    batchSize: peerIds.length,
    branding: pdfBranding,
  });
  // renderToBuffer is typed against the @react-pdf <Document> element. Our
  // wrapper returns one but TS can't see through the FC boundary, so cast.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(docEl as any);

  const safeName = student.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "student";
  const filename = `parent-report-${safeName}-${input.studentId}-${now.toISOString().slice(0, 10)}.pdf`;

  return {
    pdfBuffer,
    summary: {
      studentName: student.name,
      batchName: batch.name,
      attemptsCount: studentAttempts.length,
      averagePct,
      attendancePct,
      assignedCount,
      completedCount,
      batchAveragePct,
      batchSize: peerIds.length,
      trend,
      weakTopics,
      periodStart: since.toISOString(),
      periodEnd:   now.toISOString(),
    },
    filename,
    empty: false,
  };
}
