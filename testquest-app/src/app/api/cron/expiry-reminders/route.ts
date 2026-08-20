import { prisma } from "@/lib/db";
import { handleApiError, success, error } from "@/lib/api-utils";
import { sendExpiryReminder } from "@/lib/email-lifecycle";
import type { ExpiryStage } from "@/emails/templates";

/**
 * POST /api/cron/expiry-reminders — the expiry series.
 *
 * Vercel-cron entry point, scheduled daily in `vercel.json`, following the
 * same contract as the weekly-reports job: `Authorization: Bearer
 * ${CRON_SECRET}`, and **fail closed** when the secret isn't configured — an
 * unauthenticated endpoint that emails thousands of people is not a thing to
 * leave open.
 *
 * Four stages, each a window rather than an instant: cron granularity is a day
 * and a run can be late, retried or doubled, so "expires in exactly 7 days"
 * would silently miss people. `sendOnce` keys on (stage, pass), so overlapping
 * windows and repeated runs cost nothing — the second attempt is a no-op.
 *
 * Also safe to call by hand for a backfill; that is the same idempotent path.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Day offsets from now, as [from, to) on the pass's expiry. */
const STAGES: Array<{ stage: ExpiryStage; fromDays: number; toDays: number }> = [
  { stage: "T-7",    fromDays: 6,   toDays: 8 },   // about a week out
  { stage: "T-1",    fromDays: 0,   toDays: 2 },   // tomorrow
  { stage: "day-of", fromDays: 0,   toDays: 1 },   // today
  { stage: "post",   fromDays: -8,  toDays: -1 },  // ended in the last week
];

function isAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false; // fail closed when unconfigured
  const match = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  return !!match && match[1] === expected;
}

const at = (days: number) => new Date(Date.now() + days * 86_400_000);

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) return error("Unauthorized", 401);

    const results: Record<string, { candidates: number; sent: number; skipped: number; failed: number }> = {};

    for (const { stage, fromDays, toDays } of STAGES) {
      const passes = await prisma.classAccess.findMany({
        where: { expiresAt: { gte: at(fromDays), lt: at(toDays) } },
        select: { id: true, studentId: true, boardId: true, classId: true, expiresAt: true },
        take: 500,
      });

      // A student who renewed already holds a later pass for the same scope —
      // reminding them their old one is ending would be nonsense.
      const stillExpiring = [];
      for (const p of passes) {
        const later = await prisma.classAccess.findFirst({
          where: {
            studentId: p.studentId, boardId: p.boardId, classId: p.classId,
            expiresAt: { gt: p.expiresAt },
          },
          select: { id: true },
        });
        if (!later) stillExpiring.push(p);
      }

      let sent = 0, skipped = 0, failed = 0;
      for (const p of stillExpiring) {
        const outcome = await sendExpiryReminder(p.id, stage);
        if (outcome.sent) sent++;
        else if (outcome.reason === "provider_error") failed++;
        else skipped++; // duplicate or unsubscribed — both are correct outcomes
      }
      results[stage] = { candidates: stillExpiring.length, sent, skipped, failed };
    }

    return success({ ranAt: new Date(), stages: results });
  } catch (err) {
    return handleApiError(err);
  }
}
