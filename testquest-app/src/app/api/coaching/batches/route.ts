/**
 * POST /api/coaching/batches
 *
 * Owner / ADMIN creates a new batch within their org. Wraps
 * `batch.service.createBatch` so all batch-creation goes through the same
 * helper (incl. subjectsCsv normalisation).
 *
 * Used by /coaching/batches/new and (later) any "add another batch" CTA.
 */
import { z } from "zod";
import { requireOrgRole } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { createBatch } from "@/lib/services/batch.service";
import { resolveSubscriptionState } from "@/lib/services/subscription.service";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  name:     z.string().min(1).max(200),
  classId:  z.number().int().positive(),
  board:    z.string().min(1).max(50),
  subjects: z.array(z.string().min(1).max(80)).min(1).max(20),
});

export async function POST(req: Request) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN"]);

    // Hard subscription gate — EXPIRED orgs can't create new batches either.
    const billing = await resolveSubscriptionState(session.orgId!);
    if (billing.hardLockout) {
      return error("Subscription expired. Upgrade to add new batches.", 402);
    }

    const body = await parseBody(req, createSchema);

    // Validate classId against vw_classes (same pattern as the setup wizard).
    const cls = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM vw_classes WHERE id = ${body.classId} AND isActive = 1 LIMIT 1
    `;
    if (!cls.length) return error(`Invalid classId ${body.classId}`, 422);

    const batch = await createBatch({ orgId: session.orgId!, ...body });
    return success({ id: batch.id }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
