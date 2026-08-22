/**
 * POST /api/coaching/assignments/[id]/remind
 *
 * Bulk-send SMS reminders to students who have NOT started this assignment.
 * Owner / Admin / Teacher only. Dedupes by mobile number so a student
 * enrolled in two batches doesn't get spammed.
 *
 * Returns counts: { targeted, sent, skipped }. In dev the SMS path logs to
 * console via lib/sms.ts; in production it's a no-op until a real provider
 * lands.
 */
import { prisma } from "@/lib/db";
import { requireOrgRole } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import { sendNotificationBroadcast } from "@/lib/notifications";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN", "TEACHER"]);
    const { id } = await params;
    const assignmentId = Number(id);
    if (!Number.isFinite(assignmentId)) return error("Bad id", 400);

    const a = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { org: { select: { name: true } } },
    });
    if (!a || a.orgId !== session.orgId) return error("Assignment not found", 404);

    // All enrolled students in the batch.
    const enrollments = await prisma.batchEnrollment.findMany({
      where: { batchId: a.batchId, isActive: true },
      select: { studentId: true },
    });
    const studentIds = enrollments.map((e) => e.studentId);
    if (studentIds.length === 0) return success({ targeted: 0, sent: 0, skipped: 0 });

    // Anyone with a mapping row has at least started (or completed).
    const startedMappings = await prisma.assignmentAttempt.findMany({
      where: { assignmentId },
      select: { studentId: true },
    });
    const startedIds = new Set(startedMappings.map((m) => m.studentId));

    const notStartedIds = studentIds.filter((sid) => !startedIds.has(sid));
    if (notStartedIds.length === 0) return success({ targeted: 0, sent: 0, skipped: 0 });

    // Mobile lookup, dedup by mobile.
    const mobiles = await prisma.$queryRawUnsafe<Array<{ id: number; name: string; mobile: string | null }>>(
      `SELECT id, name, mobile FROM vw_students WHERE id IN (${notStartedIds.map(() => "?").join(",")})`,
      ...notStartedIds,
    );
    const seenMobiles = new Set<string>();
    const orgName = a.org?.name ?? "your centre";
    const link = `/coaching/assignments/${a.id}`;
    const dueText = a.dueAt
      ? `Due ${a.dueAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
      : undefined;

    let sent = 0; let skipped = 0;
    for (const s of mobiles) {
      const m = (s.mobile ?? "").replace(/\D+/g, "");
      if (m.length < 10) { skipped++; continue; }
      if (seenMobiles.has(m)) { skipped++; continue; }
      seenMobiles.add(m);
      // Reminder fans out across WhatsApp + SMS for redundancy. Phase 2 / 2.6:
      // WhatsApp wins where reachable; SMS is the fallback.
      const result = await sendNotificationBroadcast({
        template: "assignment-reminder",
        params: { orgName, testName: a.title ?? "test", dueText, link },
        recipient: { mobile: m },
        channels: ["whatsapp", "sms"],
      });
      if (result.delivered > 0) sent++; else skipped++;
    }

    return success({ targeted: notStartedIds.length, sent, skipped });
  } catch (err) {
    return handleApiError(err);
  }
}
