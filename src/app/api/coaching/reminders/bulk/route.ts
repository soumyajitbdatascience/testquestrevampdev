/**
 * POST /api/coaching/reminders/bulk
 *
 * Owner/Admin one-click "remind everyone behind" across many assignments.
 * See lib/services/bulk-reminder.service.ts for scope + dedupe semantics.
 *
 * GET returns a pre-flight count (assignments + unique students) so the UI
 * can confirm before firing real messages.
 */
import { z } from "zod";
import { requireOrgRole } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import {
  sendBulkReminders,
  previewBulkReminders,
  BulkReminderTooManyError,
  BULK_REMINDER_ASSIGNMENT_CAP,
} from "@/lib/services/bulk-reminder.service";

const BodySchema = z.object({
  scope: z.enum(["all-active", "this-week"]).optional().default("this-week"),
});

export async function POST(req: Request) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN"]);
    if (!session.orgId) return error("No organization on session", 403);
    let raw: unknown = {};
    try {
      raw = await req.json();
    } catch {
      raw = {};
    }
    const body = BodySchema.parse(raw ?? {});
    const result = await sendBulkReminders({
      orgId: session.orgId,
      actingUserId: session.id,
      scope: body.scope,
    });
    return success(result);
  } catch (err) {
    if (err instanceof BulkReminderTooManyError) {
      return error(
        `Too many assignments in scope (${err.count}). Limit is ${BULK_REMINDER_ASSIGNMENT_CAP}. Switch to "this-week" or run per-batch reminders.`,
        400,
      );
    }
    return handleApiError(err);
  }
}

export async function GET(req: Request) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN"]);
    if (!session.orgId) return error("No organization on session", 403);
    const url = new URL(req.url);
    const scopeRaw = url.searchParams.get("scope") ?? "this-week";
    const parsed = z.enum(["all-active", "this-week"]).safeParse(scopeRaw);
    if (!parsed.success) return error("Bad scope", 400);
    const preview = await previewBulkReminders({
      orgId: session.orgId,
      scope: parsed.data,
    });
    return success(preview);
  } catch (err) {
    return handleApiError(err);
  }
}
