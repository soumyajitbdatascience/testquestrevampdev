/**
 * POST /api/coaching/batches/[id]/students/import — Task 5.3.3.
 *
 * Multipart upload (`file` field). OWNER/ADMIN only. Parses the CSV, validates
 * rows, and enrolls valid students via `addStudentsToBatch`. Returns a
 * structured CsvImportResult so the client can render per-row outcomes.
 */
import { prisma } from "@/lib/db";
import { requireOrgRole } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import {
  importStudentsFromCsv,
  CsvImportError,
} from "@/lib/services/csv-import.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN"]);
    const { id } = await params;
    const batchId = Number(id);
    if (!Number.isFinite(batchId)) return error("Bad batch id", 400);

    // Scope check — batch must belong to the caller's org.
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      select: { id: true, orgId: true, isActive: true },
    });
    if (!batch || batch.orgId !== session.orgId) {
      return error("Batch not found", 404);
    }
    if (!batch.isActive) {
      return error("Batch is archived", 400);
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return error("Expected multipart/form-data with a 'file' field", 400);
    }

    const file = form.get("file");
    if (!file || typeof file === "string") {
      return error("Missing 'file' upload", 400);
    }
    // Web File / Blob — both expose .text() in the Next runtime.
    const csvText = await (file as Blob).text();

    const result = await importStudentsFromCsv({
      orgId: session.orgId!,
      batchId,
      csvText,
      actingUserId: session.id,
    });

    return success(result);
  } catch (err) {
    if (err instanceof CsvImportError) {
      return error(err.message, 400);
    }
    return handleApiError(err);
  }
}
