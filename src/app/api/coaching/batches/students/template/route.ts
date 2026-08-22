/**
 * GET /api/coaching/batches/students/template
 *
 * Returns a tiny CSV with the header + 2 sample rows the owner can fill in
 * and re-upload via the batch CSV import flow (Task 5.3.3).
 */
import { requireOrgRole } from "@/lib/auth";
import { handleApiError } from "@/lib/api-utils";
import { buildCsvTemplate } from "@/lib/services/csv-import.service";

export async function GET() {
  try {
    await requireOrgRole(["OWNER", "ADMIN", "TEACHER"]);
    const body = buildCsvTemplate();
    return new Response(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=testquest_students_template.csv",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
