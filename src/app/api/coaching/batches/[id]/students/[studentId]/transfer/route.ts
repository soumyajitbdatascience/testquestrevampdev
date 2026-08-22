/**
 * POST /api/coaching/batches/[id]/students/[studentId]/transfer
 *
 * Task 4.5 — one-click batch transfer with history preservation.
 *
 * Body: { toBatchId: number }
 * Soft-deletes the active enrollment on `[id]` (the source batch) and
 * activates a fresh enrollment on `toBatchId`. Both batches must belong to
 * the caller's organisation. OWNER / ADMIN only.
 */
import { z } from "zod";
import { requireOrgRole } from "@/lib/auth";
import { handleApiError, success, error, parseBody } from "@/lib/api-utils";
import { BatchError, transferStudent } from "@/lib/services/batch.service";

type Params = { params: Promise<{ id: string; studentId: string }> };

const Body = z.object({
  toBatchId: z.number().int().positive(),
});

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN"]);
    const { id, studentId } = await params;
    const fromBatchId = Number(id);
    const sid = Number(studentId);
    if (!Number.isFinite(fromBatchId) || !Number.isFinite(sid)) {
      return error("Bad ids", 400);
    }
    const body = await parseBody(req, Body);

    const result = await transferStudent({
      studentId: sid,
      fromBatchId,
      toBatchId: body.toBatchId,
      actingUserId: session.id,
      actingOrgId: session.orgId!,
    });
    return success(result);
  } catch (err) {
    if (err instanceof BatchError) {
      const status =
        err.code === "ALREADY_THERE"
          ? 409
          : err.code === "BATCH_NOT_FOUND"
            ? 404
            : err.code === "CROSS_ORG"
              ? 403
              : 400;
      return error(err.message, status);
    }
    return handleApiError(err);
  }
}
