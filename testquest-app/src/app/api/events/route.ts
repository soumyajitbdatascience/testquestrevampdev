import { z } from "zod";
import { getSession } from "@/lib/auth";
import { handleApiError, parseBody, success } from "@/lib/api-utils";
import { track } from "@/lib/events";

/**
 * Client-side event beacon (tq_events). Allowlisted names only — server-side
 * truths (purchases, pass grants) are tracked server-side, not here.
 */
const ALLOWED = new Set([
  "paywall_open",
  "plan_selected",
  "coupon_applied",
  "coupon_rejected",
  "onboarding_completed",
  "sample_result_viewed",
  "video_locked_viewed",
]);

const eventSchema = z.object({
  name: z.string().min(1).max(80),
  properties: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, eventSchema);
    if (!ALLOWED.has(body.name)) return success({ ignored: true });
    const session = await getSession();
    await track(body.name, session?.role === "student" ? session.id : null, body.properties);
    return success({ tracked: true });
  } catch (err) {
    return handleApiError(err);
  }
}
