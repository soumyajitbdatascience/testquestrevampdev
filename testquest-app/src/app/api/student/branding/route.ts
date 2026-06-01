/**
 * GET /api/student/branding — resolve the white-label branding to apply for
 * the currently-signed-in student. Returns `{ ok: true, data: null }` for
 * B2C students (no org context / plan gate fails).
 *
 * Consumed by `<BrandingProvider>` to hydrate the client context.
 */
import { getSession } from "@/lib/auth";
import { handleApiError, success } from "@/lib/api-utils";
import { loadStudentOrgBranding } from "@/lib/org-branding";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "student") return success(null);
    const branding = await loadStudentOrgBranding(session.id);
    return success(branding);
  } catch (err) {
    return handleApiError(err);
  }
}
