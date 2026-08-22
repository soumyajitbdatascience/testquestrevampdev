/**
 * GET  /api/coaching/batches/[id]/teachers — list teachers on this batch
 * POST /api/coaching/batches/[id]/teachers — assign a teacher to this batch
 *
 * Phase 4 / Task 4.6. OWNER/ADMIN can write; everyone non-STUDENT can read.
 */
import { z } from "zod";
import { requireOrgRole } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { prisma } from "@/lib/db";
import {
  listTeachersForBatch,
  assignTeacherToBatch,
  BatchTeacherError,
} from "@/lib/services/batch-teachers.service";

async function ensureBatchInOrg(batchId: number, orgId: number): Promise<boolean> {
  const b = await prisma.batch.findUnique({ where: { id: batchId }, select: { orgId: true } });
  return !!b && b.orgId === orgId;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN", "TEACHER"]);
    const { id } = await ctx.params;
    const batchId = Number(id);
    if (!Number.isFinite(batchId)) return error("Bad id", 400);
    if (!(await ensureBatchInOrg(batchId, session.orgId!))) return error("Batch not found", 404);
    const teachers = await listTeachersForBatch(batchId);
    return success({ teachers: teachers.map((t) => ({ ...t, assignedAt: t.assignedAt.toISOString() })) });
  } catch (err) {
    return handleApiError(err);
  }
}

const assignSchema = z.object({
  userId: z.number().int().positive(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN"]);
    const { id } = await ctx.params;
    const batchId = Number(id);
    if (!Number.isFinite(batchId)) return error("Bad id", 400);
    const body = await parseBody(req, assignSchema);
    await assignTeacherToBatch({
      batchId,
      userId: body.userId,
      actingOrgId: session.orgId!,
    });
    return success({ assigned: true });
  } catch (err) {
    if (err instanceof BatchTeacherError) return error(err.message, err.status);
    return handleApiError(err);
  }
}
