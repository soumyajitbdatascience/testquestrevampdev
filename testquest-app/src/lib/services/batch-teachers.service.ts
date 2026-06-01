/**
 * batch-teachers service — Phase 4 / Task 4.6.
 *
 * Owns the per-batch teacher mapping (tq_batch_teachers). Used by:
 *  - The batch detail page to render a "teachers on this batch" list
 *  - The team revoke flow (when a TEACHER membership is being revoked,
 *    we need to know which batches they teach so the owner can nominate
 *    replacements before the revoke goes through)
 *  - Future Phase 4 work (e.g. teacher self-service "my batches" view)
 *
 * Cascade access: an OWNER/ADMIN of the org never gets a row here — they
 * have full org-wide access by role. Only TEACHER rows live in this table.
 */
import { prisma } from "@/lib/db";
import { OrgRole } from "@/generated/prisma/client";

export class BatchTeacherError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

// ─── Reads ─────────────────────────────────────────────────────────

export interface BatchTeacherRow {
  id: number;
  userId: number;
  name: string | null;
  email: string | null;
  assignedAt: Date;
}

export async function listTeachersForBatch(batchId: number): Promise<BatchTeacherRow[]> {
  const rows = await prisma.batchTeacher.findMany({
    where: { batchId, isActive: true },
    orderBy: { assignedAt: "asc" },
  });
  if (rows.length === 0) return [];
  const userIds = rows.map((r) => r.userId);
  const placeholders = userIds.map(() => "?").join(",");
  const profiles = await prisma.$queryRawUnsafe<Array<{ id: number; name: string; email: string | null }>>(
    `SELECT id, name, email FROM vw_students WHERE id IN (${placeholders})`,
    ...userIds,
  );
  const byId = new Map(profiles.map((p) => [Number(p.id), p]));
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    name: byId.get(r.userId)?.name ?? null,
    email: byId.get(r.userId)?.email ?? null,
    assignedAt: r.assignedAt,
  }));
}

export interface BatchSummary {
  batchId: number;
  batchName: string;
}

/**
 * Returns the active batches this user teaches IN THE GIVEN ORG. Used by
 * the team revoke flow to enumerate what needs reassigning before a TEACHER
 * membership can be safely removed.
 */
export async function listBatchesForTeacher(orgId: number, userId: number): Promise<BatchSummary[]> {
  const rows = await prisma.batchTeacher.findMany({
    where: {
      userId,
      isActive: true,
      batch: { orgId, isActive: true },
    },
    include: { batch: { select: { id: true, name: true } } },
  });
  return rows.map((r) => ({ batchId: r.batch.id, batchName: r.batch.name }));
}

// ─── Writes ────────────────────────────────────────────────────────

interface AssignInput {
  batchId: number;
  userId: number;
  /** The org performing the assign — used to scope-check the batch and the membership. */
  actingOrgId: number;
}

export async function assignTeacherToBatch(input: AssignInput): Promise<{ assigned: true }> {
  // Batch belongs to the calling org?
  const batch = await prisma.batch.findUnique({
    where: { id: input.batchId },
    select: { orgId: true, isActive: true },
  });
  if (!batch || !batch.isActive) throw new BatchTeacherError("BATCH_NOT_FOUND", "Batch not found.", 404);
  if (batch.orgId !== input.actingOrgId) throw new BatchTeacherError("CROSS_ORG", "Batch belongs to another organisation.", 403);

  // Target user has TEACHER membership on the same org?
  const membership = await prisma.orgMembership.findFirst({
    where: { orgId: input.actingOrgId, userId: input.userId, role: OrgRole.TEACHER, isActive: true },
  });
  if (!membership) {
    throw new BatchTeacherError(
      "NOT_TEACHER",
      "Pick a teacher who is already part of your centre.",
      422,
    );
  }

  // Idempotent — re-activate if soft-deleted, no-op if already active.
  const existing = await prisma.batchTeacher.findUnique({
    where: { batchId_userId: { batchId: input.batchId, userId: input.userId } },
  });
  if (existing) {
    if (existing.isActive) return { assigned: true };
    await prisma.batchTeacher.update({
      where: { id: existing.id },
      data: { isActive: true, assignedAt: new Date() },
    });
    return { assigned: true };
  }
  await prisma.batchTeacher.create({
    data: { batchId: input.batchId, userId: input.userId },
  });
  return { assigned: true };
}

interface RemoveInput {
  batchId: number;
  userId: number;
  actingOrgId: number;
}

export async function removeTeacherFromBatch(input: RemoveInput): Promise<{ removed: boolean }> {
  const batch = await prisma.batch.findUnique({
    where: { id: input.batchId },
    select: { orgId: true },
  });
  if (!batch) throw new BatchTeacherError("BATCH_NOT_FOUND", "Batch not found.", 404);
  if (batch.orgId !== input.actingOrgId) throw new BatchTeacherError("CROSS_ORG", "Batch belongs to another organisation.", 403);

  const existing = await prisma.batchTeacher.findUnique({
    where: { batchId_userId: { batchId: input.batchId, userId: input.userId } },
  });
  if (!existing || !existing.isActive) return { removed: false };
  await prisma.batchTeacher.update({
    where: { id: existing.id },
    data: { isActive: false },
  });
  return { removed: true };
}

// ─── Reassignment helper ───────────────────────────────────────────

interface ReassignInput {
  /** Map of batchId → replacement teacher's userId. `null` value = batch becomes
   *  owner-managed (no teacher row written). */
  reassignments: Record<number, number | null>;
  /** The teacher whose batches are being reassigned (so we soft-delete their rows). */
  fromUserId: number;
  actingOrgId: number;
}

/**
 * Atomic reassignment: for each batch in `reassignments`, soft-delete the
 * outgoing teacher's row and (if a replacement is provided) write a row for
 * the new teacher. Used by the team revoke flow after the owner picks a plan.
 */
export async function applyReassignments(input: ReassignInput): Promise<{ reassigned: number; unassigned: number }> {
  let reassigned = 0;
  let unassigned = 0;
  await prisma.$transaction(async (tx) => {
    for (const [batchIdStr, replacementId] of Object.entries(input.reassignments)) {
      const batchId = Number(batchIdStr);
      const batch = await tx.batch.findUnique({ where: { id: batchId }, select: { orgId: true } });
      if (!batch || batch.orgId !== input.actingOrgId) {
        throw new BatchTeacherError("CROSS_ORG", `Batch ${batchId} isn't yours.`, 403);
      }
      // Soft-delete the outgoing teacher.
      const out = await tx.batchTeacher.findUnique({
        where: { batchId_userId: { batchId, userId: input.fromUserId } },
      });
      if (out && out.isActive) {
        await tx.batchTeacher.update({ where: { id: out.id }, data: { isActive: false } });
      }
      // Optionally assign a replacement.
      if (replacementId != null) {
        const member = await tx.orgMembership.findFirst({
          where: { orgId: input.actingOrgId, userId: replacementId, role: OrgRole.TEACHER, isActive: true },
        });
        if (!member) {
          throw new BatchTeacherError(
            "BAD_REPLACEMENT",
            `Replacement for batch ${batchId} isn't a teacher in your centre.`,
            422,
          );
        }
        const existing = await tx.batchTeacher.findUnique({
          where: { batchId_userId: { batchId, userId: replacementId } },
        });
        if (existing) {
          if (!existing.isActive) {
            await tx.batchTeacher.update({
              where: { id: existing.id },
              data: { isActive: true, assignedAt: new Date() },
            });
          }
        } else {
          await tx.batchTeacher.create({ data: { batchId, userId: replacementId } });
        }
        reassigned++;
      } else {
        unassigned++;
      }
    }
  });
  return { reassigned, unassigned };
}
