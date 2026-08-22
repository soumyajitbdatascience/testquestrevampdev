/**
 * DELETE /api/coaching/batches/[id]/teachers/[userId] — remove a teacher
 * from this batch (soft-delete the mapping row).
 *
 * Phase 4 / Task 4.6. OWNER/ADMIN only.
 */
import { requireOrgRole } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import {
  removeTeacherFromBatch,
  BatchTeacherError,
} from "@/lib/services/batch-teachers.service";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; userId: string }> },
) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN"]);
    const { id, userId } = await ctx.params;
    const batchId = Number(id);
    const uid = Number(userId);
    if (!Number.isFinite(batchId) || !Number.isFinite(uid)) return error("Bad id", 400);
    const result = await removeTeacherFromBatch({
      batchId,
      userId: uid,
      actingOrgId: session.orgId!,
    });
    return success(result);
  } catch (err) {
    if (err instanceof BatchTeacherError) return error(err.message, err.status);
    return handleApiError(err);
  }
}
