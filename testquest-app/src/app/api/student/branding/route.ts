/**
 * GET /api/student/branding — resolve the white-label branding to apply for
 * the currently-signed-in student. Returns `{ ok: true, data: null }` for
 * B2C students, which on this database is every student.
 *
 * Consumed by `<BrandingProvider>` to hydrate the client context — it runs on
 * *every* student page load, which is why it must never touch a table that
 * isn't here. White-labelling is a coaching (B2B) feature and its tables
 * (`tq_organizations`, `tq_batch_enrollments`, `tq_subscriptions`) do not
 * exist in this DB, so `loadStudentOrgBranding` is deliberately not called;
 * the resolver and the rest of the B2B stack are left untouched for whenever
 * coaching runs against its own schema.
 */
import { getSession } from "@/lib/auth";
import { handleApiError, success } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getSession();
    return success(null);
  } catch (err) {
    return handleApiError(err);
  }
}
