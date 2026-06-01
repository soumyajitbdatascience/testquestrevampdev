/**
 * POST /api/coaching/batches/[id]/students/[studentId]/send-report — Task 3.3.
 *
 * Generates a parent report PDF (via the same `buildParentReport` service the
 * `/generate` endpoint uses), writes it to the placeholder uploads dir, then
 * fans the URL out across WhatsApp / SMS / Email to the student's contact
 * details — for MVP the student themselves IS the parent contact (no separate
 * parent record exists in the legacy DB). Phase 4 will add real parent
 * records and we'll switch the recipient lookup then.
 *
 * Auth: OWNER / ADMIN / TEACHER of the org that owns the batch.
 * Returns: { ok: true, data: { url, filename, deliveredChannels } } on send,
 *          { ok: false, error: "Not enough activity yet — assign a test first." }
 *          when the student has no finished attempts in the window.
 */
import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { requireOrgRole } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import { buildParentReport } from "@/lib/services/parent-report.service";
import { sendNotificationBroadcast, type Channel } from "@/lib/notifications";
import { buildEmailBranding } from "@/lib/branding-for-email";

// UPLOADS_V2_TODO: Phase 5 should swap to S3/R2 with signed URLs + retention.
// Mirrors the placeholder path used by /api/coaching/parent-reports/generate.
const REPORTS_DIR = path.join(process.cwd(), "public", "uploads", "reports");

function absoluteUrl(pathStr: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${pathStr}`;
}

type Params = { params: Promise<{ id: string; studentId: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN", "TEACHER"]);
    const { id, studentId } = await params;
    const batchId = Number(id);
    const sid = Number(studentId);
    if (!Number.isFinite(batchId) || !Number.isFinite(sid)) return error("Bad ids", 400);

    // Verify batch belongs to this org.
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      select: { id: true, orgId: true, org: { select: { name: true } } },
    });
    if (!batch || batch.orgId !== session.orgId) return error("Batch not found", 404);

    // Verify the student is enrolled in this batch (active).
    const enrollment = await prisma.batchEnrollment.findUnique({
      where: { batchId_studentId: { batchId, studentId: sid } },
      select: { id: true, isActive: true },
    });
    if (!enrollment || !enrollment.isActive) {
      return error("Student is not in this batch.", 404);
    }

    // Build the PDF + summary.
    const result = await buildParentReport({
      orgId: session.orgId!,
      studentId: sid,
      batchId,
    });

    if (result.empty) {
      return error("Not enough activity yet — assign a test first.", 400);
    }

    // Persist the PDF and form the URL.
    await fs.mkdir(REPORTS_DIR, { recursive: true });
    const token = randomBytes(16).toString("hex");
    const fileName = `${token}.pdf`;
    const absPath = path.join(REPORTS_DIR, fileName);
    await fs.writeFile(absPath, result.pdfBuffer);
    const relativeUrl = `/uploads/reports/${fileName}`;
    const shareUrl = absoluteUrl(relativeUrl);

    // Look up the student's parent contact. PHASE 4 NOTE: for MVP the student
    // record itself is the parent contact — there is no separate parent table
    // in the legacy DB. When real parent records arrive, swap this lookup.
    const contacts = await prisma.$queryRawUnsafe<Array<{ email: string | null; mobile: string | null }>>(
      `SELECT email, mobile FROM vw_students WHERE id = ? LIMIT 1`,
      sid,
    );
    const contact = contacts[0] ?? { email: null, mobile: null };

    const studentFirstName = (result.summary.studentName || "your child").split(/\s+/)[0] || "your child";
    const orgName = batch.org?.name ?? "Your centre";

    const branding = await buildEmailBranding(session.orgId!);
    const broadcast = await sendNotificationBroadcast({
      template: "parent-report-ready",
      params: { studentFirstName, orgName, url: shareUrl },
      recipient: { mobile: contact.mobile, email: contact.email, branding },
      channels: ["whatsapp", "sms", "email"] as readonly Channel[],
    });

    const deliveredChannels = broadcast.results
      .filter((r) => r.delivered)
      .map((r) => r.channel);

    return success({
      url: relativeUrl,
      filename: result.filename,
      deliveredChannels,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
