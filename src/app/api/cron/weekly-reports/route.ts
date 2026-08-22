/**
 * POST /api/cron/weekly-reports — Phase 3 / Task 3.2.
 *
 * Vercel-cron entry point. Scheduled in vercel.json for Sunday 03:30 UTC
 * (09:00 IST). Also callable ad-hoc from a script for backfills / testing.
 *
 * Auth: `Authorization: Bearer ${process.env.CRON_SECRET}`. The same secret
 * is set on the Vercel dashboard as an env var; Vercel Cron will send it
 * automatically when configured.
 *
 * Body (all optional):
 *   { orgIds?: number[], limit?: number }
 *
 * Response: WeeklyRunSummary from the service.
 *
 * REQUIRED ENV: `CRON_SECRET` must be set. Without it, the route returns 401
 * for all callers (which is desirable: it fails closed).
 */
import { z } from "zod";
import { handleApiError, success, error } from "@/lib/api-utils";
import { runWeeklyReports } from "@/lib/services/weekly-report-cron.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BodySchema = z.object({
  orgIds: z.array(z.number().int().positive()).optional(),
  limit: z.number().int().positive().max(2000).optional(),
});

function isAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false; // fail-closed when the secret isn't configured
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  return match[1] === expected;
}

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) return error("Unauthorized", 401);

    let body: z.infer<typeof BodySchema> = {};
    try {
      const text = await req.text();
      if (text.trim().length > 0) {
        body = BodySchema.parse(JSON.parse(text));
      }
    } catch {
      return error("Invalid JSON body", 400);
    }

    const summary = await runWeeklyReports({
      orgIds: body.orgIds,
      limit: body.limit,
    });
    return success(summary);
  } catch (err) {
    return handleApiError(err);
  }
}
