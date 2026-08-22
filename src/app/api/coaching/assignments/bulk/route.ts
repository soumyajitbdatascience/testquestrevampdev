/**
 * POST /api/coaching/assignments/bulk — Task 5.3.1.
 *
 * Owner / Admin assigns a single test to multiple batches in one shot.
 * Teachers are excluded from bulk on purpose: per-batch only is the policy
 * for non-OWNER roles. Up to 50 batches per call.
 */
import { z } from "zod";
import { requireOrgRole } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import {
  createBulkAssignments,
  BulkAssignError,
} from "@/lib/services/bulk-assign.service";
import { resolveSubscriptionState } from "@/lib/services/subscription.service";

const bulkSchema = z.object({
  batchIds: z.array(z.number().int().positive()).min(1).max(50),
  testId: z.number().int().positive(),
  title: z.string().min(1).max(300).optional().nullable(),
  instructions: z.string().max(2000).optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
  notify: z.array(z.enum(["sms", "email"])).default([]),
});

export async function POST(req: Request) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN"]);
    const body = await parseBody(req, bulkSchema);

    // Subscription gating — same rule as the single-assign route.
    const billing = await resolveSubscriptionState(session.orgId!);
    if (!billing.canAssign) {
      return error(
        billing.banner === "expired"
          ? "Subscription expired. Upgrade to assign tests."
          : "Trial ended. Upgrade to assign new tests.",
        402,
      );
    }

    const result = await createBulkAssignments({
      orgId: session.orgId!,
      actingUserId: session.id,
      batchIds: body.batchIds,
      testId: body.testId,
      title: body.title ?? null,
      instructions: body.instructions ?? null,
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
      notify: body.notify,
    });

    // 201 if at least one assignment landed; 207-ish (use 200) for full-fail
    // so the client can still inspect per-batch failures.
    return success(result, result.successCount > 0 ? 201 : 200);
  } catch (err) {
    if (err instanceof BulkAssignError) {
      return error(err.message, err.code === "CROSS_ORG" ? 403 : 400);
    }
    return handleApiError(err);
  }
}
