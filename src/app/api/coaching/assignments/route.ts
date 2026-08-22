/**
 * POST /api/coaching/assignments
 *
 * Owner / ADMIN creates an assignment for a batch in their org. Synchronously
 * fans out SMS + email notifications via assignment.service. The route
 * returns enrollment + notification stats so the UI can display
 * "Assigned to N students · M SMS sent · L emails sent".
 */
import { z } from "zod";
import { requireOrgRole } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { createAssignment } from "@/lib/services/assignment.service";
import { resolveSubscriptionState } from "@/lib/services/subscription.service";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  batchId:      z.number().int().positive(),
  testId:       z.number().int().positive(),
  title:        z.string().min(1).max(300).optional().nullable(),
  instructions: z.string().max(2000).optional().nullable(),
  dueAt:        z.string().datetime().optional().nullable(),
  notify:       z.array(z.enum(["sms", "email"])).default(["sms", "email"]),
});

export async function POST(req: Request) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN"]);
    const body = await parseBody(req, createSchema);

    // Defence in depth: confirm the batch belongs to this org.
    const batch = await prisma.batch.findUnique({
      where: { id: body.batchId },
      select: { orgId: true, classId: true },
    });
    if (!batch || batch.orgId !== session.orgId) return error("Batch not found", 404);

    // Subscription gating — Task 1.11. Trial / Active orgs can assign; GRACE
    // and EXPIRED cannot. The page also disables the CTA, but enforce here too.
    const billing = await resolveSubscriptionState(session.orgId!);
    if (!billing.canAssign) {
      return error(
        billing.banner === "expired"
          ? "Subscription expired. Upgrade to assign tests."
          : "Trial ended. Upgrade to assign new tests.",
        402,
      );
    }

    const result = await createAssignment({
      orgId: session.orgId!,
      batchId: body.batchId,
      testId: body.testId,
      title: body.title ?? null,
      instructions: body.instructions ?? null,
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
      notify: body.notify,
      assignedBy: session.id,
    });
    return success(result, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
