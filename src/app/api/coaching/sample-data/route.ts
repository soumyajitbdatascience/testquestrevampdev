/**
 * DELETE /api/coaching/sample-data — Task 5.4.
 *
 * Tears down the demo batch + 10 fake students + sample assignment that the
 * trial signup seeded. OWNER or ADMIN can call. Idempotent: deleting when
 * no marker exists returns zero counts and 200.
 *
 * The dashboard reads marker state server-side via getSampleData(), so there's
 * no GET endpoint — the banner that triggers this call is rendered when the
 * marker exists on render.
 */
import { requireOrgRole } from "@/lib/auth";
import { handleApiError, success } from "@/lib/api-utils";
import { removeSampleData } from "@/lib/services/sample-data.service";

export async function DELETE() {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN"]);
    const result = await removeSampleData(session.orgId!);
    return success(result);
  } catch (err) {
    return handleApiError(err);
  }
}
