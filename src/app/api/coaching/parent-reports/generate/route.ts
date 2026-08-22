/**
 * POST /api/coaching/parent-reports/generate — Task 3.1.
 *
 * Body: { studentId: number, batchId: number }
 * Auth: OWNER / ADMIN / TEACHER of the org that owns the batch.
 * Returns: { ok: true, data: { url, summary, filename } }
 *
 * The PDF is written to `public/uploads/reports/<random>.pdf` and served
 * statically by Next. This is intentionally placeholder storage — Phase 5
 * (UPLOADS_V2_TODO) will swap to cloud object storage with signed URLs.
 */
import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";
import { requireOrgRole } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { buildParentReport } from "@/lib/services/parent-report.service";

const bodySchema = z.object({
  studentId: z.number().int().positive(),
  batchId:   z.number().int().positive(),
});

// UPLOADS_V2_TODO: Phase 5 should swap this to S3/R2 with signed URLs +
// retention policy. For Phase 3 we write under `public/uploads/reports/`
// so the URL is directly servable by Next's static handler.
const REPORTS_DIR = path.join(process.cwd(), "public", "uploads", "reports");

export async function POST(req: Request) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN", "TEACHER"]);
    const body = await parseBody(req, bodySchema);

    const result = await buildParentReport({
      orgId: session.orgId!,
      studentId: body.studentId,
      batchId:   body.batchId,
    });

    if (result.empty) {
      return error("Not enough activity yet — assign a test first.", 400);
    }

    await fs.mkdir(REPORTS_DIR, { recursive: true });
    const token = randomBytes(16).toString("hex");
    const fileName = `${token}.pdf`;
    const absPath = path.join(REPORTS_DIR, fileName);
    await fs.writeFile(absPath, result.pdfBuffer);

    const url = `/uploads/reports/${fileName}`;

    return success({
      url,
      filename: result.filename,
      summary: result.summary,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
