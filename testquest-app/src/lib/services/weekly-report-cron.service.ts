/**
 * Weekly parent-report cron — Phase 3 / Task 3.2.
 *
 * Picks up every eligible (org × batch × enrolled-student) for the current
 * ISO week, builds a parent report PDF via `buildParentReport`, persists it
 * under public/uploads/reports, dispatches the share URL across whatsapp +
 * sms + email, then records a row in `tq_weekly_report_runs` so a retry
 * (or the next Sunday morning) won't double-send.
 *
 * Idempotency: the UNIQUE (orgId, studentId, batchId, weekKey) constraint
 * on `tq_weekly_report_runs` is the source of truth. We check first to
 * skip cheaply, but the catch on P2002 makes the worker safe even if two
 * cron invocations race.
 *
 * Throttling: opts.limit caps the total number of students processed per
 * invocation across all orgs (default 200). On very large rollouts this
 * lets the caller split the sweep across multiple invocations / paths.
 *
 * Plan gating — see `isOrgEligible` below for the rationale.
 */
import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { buildParentReport } from "@/lib/services/parent-report.service";
import { resolveSubscriptionState } from "@/lib/services/subscription.service";
import { sendNotificationBroadcast, type Channel } from "@/lib/notifications";

// Mirrors the placeholder upload path used by the manual send-report route.
// UPLOADS_V2_TODO: Phase 5 should swap to S3/R2 with signed URLs + retention.
const REPORTS_DIR = path.join(process.cwd(), "public", "uploads", "reports");

function absoluteUrl(pathStr: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${pathStr}`;
}

// ─── Week key ─────────────────────────────────────────────────────

/**
 * ISO 8601 week format like "2026-W22". Week 01 is the week containing
 * the first Thursday of the year; weeks roll Monday–Sunday. We use UTC
 * so the cron's wall-clock zone can't shift the week boundary.
 */
export function currentWeekKey(date: Date = new Date()): string {
  // Operate on a UTC copy.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Thursday of the current ISO week — day 4. JS Sunday=0; ISO Sunday=7.
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

// ─── Plan gating ──────────────────────────────────────────────────

/**
 * Plan gate decision. Parent reports are a paid feature on the rollout
 * roadmap, but for the MVP demo we ALSO admit TRIAL orgs so a brand-new
 * Starter signup can see the cron exercise the dispatch path. Phase 4
 * may re-evaluate this and tighten to Growth+/Pro-only once the paid
 * conversion funnel exists.
 *
 * Eligible:
 *   - TRIAL orgs (any plan)
 *   - ACTIVE orgs on Growth or Pro
 * Skipped:
 *   - ACTIVE Starter (paid-but-entry-tier; reports stay paywalled)
 *   - GRACE / EXPIRED / CANCELLED (lockout)
 */
function isPlanEligible(planName: string | null, status: string | null): boolean {
  if (status === "TRIAL") return true;
  if (status !== "ACTIVE") return false;
  if (!planName) return false;
  const n = planName.toLowerCase();
  return n.includes("growth") || n.includes("pro");
}

// ─── Public types ─────────────────────────────────────────────────

export interface WeeklyRunOptions {
  now?: Date;
  /** Cap students processed per invocation across all orgs. Default 200. */
  limit?: number;
  /** Optional filter — only run for these org ids. */
  orgIds?: number[];
}

export interface WeeklyRunError {
  orgId: number;
  studentId: number;
  batchId: number;
  message: string;
}

export interface WeeklyRunSummary {
  weekKey: string;
  orgsProcessed: number;
  studentsConsidered: number;
  sent: number;
  skippedNoActivity: number;
  skippedDuplicate: number;
  skippedPlanGate: number;
  errors: WeeklyRunError[];
}

// Concurrency cap for per-student processing. PDF rendering is CPU-heavy and
// each student fans out to 3 notification providers (WA/SMS/email) which all
// have their own rate limits — 5 in flight at once is a safe default that
// keeps Vercel function execution under the timeout for 50+ student batches
// without hammering providers.
const STUDENT_CONCURRENCY = 5;

// ─── Main entry point ─────────────────────────────────────────────

export async function runWeeklyReports(opts: WeeklyRunOptions = {}): Promise<WeeklyRunSummary> {
  const now = opts.now ?? new Date();
  const limit = Math.max(1, opts.limit ?? 200);
  const weekKey = currentWeekKey(now);

  const summary: WeeklyRunSummary = {
    weekKey,
    orgsProcessed: 0,
    studentsConsidered: 0,
    sent: 0,
    skippedNoActivity: 0,
    skippedDuplicate: 0,
    skippedPlanGate: 0,
    errors: [],
  };

  // 1. Load active coaching orgs (optionally filtered).
  const orgs = await prisma.organization.findMany({
    where: {
      isActive: true,
      type: "COACHING_CENTRE",
      ...(opts.orgIds && opts.orgIds.length > 0 ? { id: { in: opts.orgIds } } : {}),
    },
    select: { id: true, name: true },
    orderBy: { id: "asc" },
  });

  let processed = 0;

  for (const org of orgs) {
    if (processed >= limit) break;

    // 2. Plan gate.
    const billing = await resolveSubscriptionState(org.id);
    if (!isPlanEligible(billing.planName, billing.status)) {
      summary.skippedPlanGate += 1;
      continue;
    }
    summary.orgsProcessed += 1;

    // 3. Active batches in this org.
    const batches = await prisma.batch.findMany({
      where: { orgId: org.id, isActive: true },
      select: { id: true },
      orderBy: { id: "asc" },
    });

    for (const batch of batches) {
      if (processed >= limit) break;

      // 4. Active enrollments.
      const enrollments = await prisma.batchEnrollment.findMany({
        where: { batchId: batch.id, isActive: true },
        select: { studentId: true },
        orderBy: { studentId: "asc" },
      });

      // Respect the global `limit` cap by trimming the enrollment list up-front
      // before fanning out concurrently.
      const remaining = Math.max(0, limit - processed);
      const eligibleEnrollments = enrollments.slice(0, remaining);

      // Process students in bounded-concurrency chunks. Per-student work is
      // independent (PDF gen + notification broadcast) so a failure on one
      // student must not abort the rest of the chunk — Promise.allSettled.
      for (let i = 0; i < eligibleEnrollments.length; i += STUDENT_CONCURRENCY) {
        const chunk = eligibleEnrollments.slice(i, i + STUDENT_CONCURRENCY);
        processed += chunk.length;
        summary.studentsConsidered += chunk.length;

        await Promise.allSettled(
          chunk.map(async (en) => {
            // 5. Idempotency check.
            const existing = await prisma.weeklyReportRun.findUnique({
              where: {
                orgId_studentId_batchId_weekKey: {
                  orgId: org.id,
                  studentId: en.studentId,
                  batchId: batch.id,
                  weekKey,
                },
              },
              select: { id: true },
            });
            if (existing) {
              summary.skippedDuplicate += 1;
              return;
            }

            try {
              await processOne({
                orgId: org.id,
                orgName: org.name,
                batchId: batch.id,
                studentId: en.studentId,
                weekKey,
                summary,
              });
            } catch (err) {
              // Prisma P2002 = race lost on UNIQUE; treat as duplicate.
              if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
                summary.skippedDuplicate += 1;
                return;
              }
              const message = err instanceof Error ? err.message : String(err);
              summary.errors.push({
                orgId: org.id,
                studentId: en.studentId,
                batchId: batch.id,
                message,
              });
              // eslint-disable-next-line no-console
              console.error(`[weekly-reports] org=${org.id} batch=${batch.id} student=${en.studentId} error=${message}`);
            }
          }),
        );
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `[weekly-reports] week=${weekKey} orgs=${summary.orgsProcessed} considered=${summary.studentsConsidered} sent=${summary.sent} skipNoActivity=${summary.skippedNoActivity} skipDup=${summary.skippedDuplicate} skipPlan=${summary.skippedPlanGate} errors=${summary.errors.length}`,
  );
  return summary;
}

// ─── Per-student worker ───────────────────────────────────────────

interface ProcessOneArgs {
  orgId: number;
  orgName: string;
  batchId: number;
  studentId: number;
  weekKey: string;
  summary: WeeklyRunSummary;
}

async function processOne(args: ProcessOneArgs): Promise<void> {
  const { orgId, orgName, batchId, studentId, weekKey, summary } = args;

  // Build the report. `empty` means "no activity in window" — write a skip
  // row so we don't re-attempt this tuple this week.
  const report = await buildParentReport({ orgId, studentId, batchId });

  if (report.empty) {
    await prisma.weeklyReportRun.create({
      data: {
        orgId,
        studentId,
        batchId,
        weekKey,
        skippedReason: "no_activity",
      },
    });
    summary.skippedNoActivity += 1;
    return;
  }

  // Persist PDF — mirror the manual send-report route's pattern.
  await fs.mkdir(REPORTS_DIR, { recursive: true });
  const token = randomBytes(16).toString("hex");
  const fileName = `${token}.pdf`;
  await fs.writeFile(path.join(REPORTS_DIR, fileName), report.pdfBuffer);
  const relativeUrl = `/uploads/reports/${fileName}`;
  const shareUrl = absoluteUrl(relativeUrl);

  // Parent contact = student contact for MVP (no separate parent table in
  // the legacy DB yet). Phase 4 swaps this for the real parent lookup.
  const contacts = await prisma.$queryRawUnsafe<Array<{ email: string | null; mobile: string | null }>>(
    `SELECT email, mobile FROM vw_students WHERE id = ? LIMIT 1`,
    studentId,
  );
  const contact = contacts[0] ?? { email: null, mobile: null };

  const studentFirstName =
    (report.summary.studentName || "your child").split(/\s+/)[0] || "your child";

  const broadcast = await sendNotificationBroadcast({
    template: "parent-report-ready",
    params: { studentFirstName, orgName, url: shareUrl },
    recipient: { mobile: contact.mobile, email: contact.email },
    channels: ["whatsapp", "sms", "email"] as readonly Channel[],
  });

  const deliveredChannels = broadcast.results
    .filter((r) => r.delivered && r.channel)
    .map((r) => r.channel as string);

  await prisma.weeklyReportRun.create({
    data: {
      orgId,
      studentId,
      batchId,
      weekKey,
      pdfUrl: relativeUrl,
      deliveredChannels: deliveredChannels.join(",") || null,
    },
  });

  summary.sent += 1;
}
