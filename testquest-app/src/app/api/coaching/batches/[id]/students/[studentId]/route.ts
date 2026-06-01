/**
 * DELETE /api/coaching/batches/[id]/students/[studentId]
 *
 * Soft-removes a student from a batch by setting `BatchEnrollment.isActive = false`.
 * Per Task 1.7 spec: "Removing a student: soft-delete `tq_batch_enrollments.status = 0`."
 * (In our Prisma schema that column is `isActive Boolean`.)
 *
 * Side effect: if this was the student's only batch in this org AND they're a
 * STUDENT-role member, we also deactivate the OrgMembership and decrement
 * Subscription.seatsUsed. That keeps the seat-cap accurate without leaking
 * seats from "ghost" memberships.
 *
 * Owner / ADMIN only.
 */
import { prisma } from "@/lib/db";
import { requireOrgRole } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string; studentId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN"]);
    const { id, studentId } = await params;
    const batchId = Number(id);
    const sid = Number(studentId);
    if (!Number.isFinite(batchId) || !Number.isFinite(sid)) return error("Bad ids", 400);

    // Verify batch belongs to this org.
    const batch = await prisma.batch.findUnique({ where: { id: batchId }, select: { orgId: true } });
    if (!batch || batch.orgId !== session.orgId) return error("Batch not found", 404);

    const enrollment = await prisma.batchEnrollment.findUnique({
      where: { batchId_studentId: { batchId, studentId: sid } },
    });
    if (!enrollment) return error("Student not in this batch", 404);
    if (!enrollment.isActive) return success({ removed: false, message: "Already removed" });

    await prisma.batchEnrollment.update({
      where: { id: enrollment.id },
      data: { isActive: false },
    });

    // If this student has no other active enrollments in this org, drop their
    // STUDENT membership and free the seat. We do this in one transaction.
    const otherActiveCount = await prisma.batchEnrollment.count({
      where: {
        studentId: sid,
        isActive: true,
        batch: { orgId: batch.orgId },
      },
    });
    let seatFreed = false;
    if (otherActiveCount === 0) {
      const m = await prisma.orgMembership.findFirst({
        where: { orgId: batch.orgId, userId: sid, role: "STUDENT", isActive: true },
      });
      if (m) {
        await prisma.$transaction(async (tx) => {
          await tx.orgMembership.update({ where: { id: m.id }, data: { isActive: false } });
          await tx.subscription.updateMany({
            where: { orgId: batch.orgId!, seatsUsed: { gt: 0 } },
            data: { seatsUsed: { decrement: 1 } },
          });
        });
        seatFreed = true;
      }
    }
    return success({ removed: true, seatFreed });
  } catch (err) {
    return handleApiError(err);
  }
}
