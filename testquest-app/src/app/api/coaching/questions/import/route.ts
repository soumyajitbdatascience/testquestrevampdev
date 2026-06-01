/**
 * POST /api/coaching/questions/import — bulk import questions from an xlsx
 * file into the org's private bank.
 *
 * Phase 2 / Task 2.3. Multipart upload with one field named `file`.
 * Returns `{ imported, skipped, errors }`. Per-row errors don't abort the
 * batch.
 *
 * TODO PLAN_GATE — once live billing is wired, return 402 if the org's
 * plan tier is Starter (custom questions are a Growth+ feature).
 */
import { requireOrgRole } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import {
  importQuestionsFromXlsx,
  QuestionBankError,
} from "@/lib/services/question-bank.service";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: Request) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN", "TEACHER"]);

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return error("Upload looks corrupted. Try again.", 400);
    }
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return error("Pick a .xlsx file to upload.", 400);
    }
    if (file.size === 0) {
      return error("That file is empty.", 400);
    }
    if (file.size > MAX_BYTES) {
      return error("File is too large. Keep imports under 5 MB.", 413);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importQuestionsFromXlsx({
      orgId:     session.orgId!,
      createdBy: session.id,
      buffer,
    });
    return success(result);
  } catch (err) {
    if (err instanceof QuestionBankError) return error(err.message, err.status);
    return handleApiError(err);
  }
}
