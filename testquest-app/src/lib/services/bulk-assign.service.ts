/**
 * Bulk assign service — Task 5.3.1.
 *
 * The owner picks one test and fans it out across multiple batches in their
 * org in a single click. This wraps `assignment.service.createAssignment` —
 * we deliberately keep all the per-batch logic (notifications, enrollment
 * lookup, defence-in-depth checks) inside that function and just orchestrate
 * the iteration here.
 *
 * Failure semantics:
 *  - Cross-org batches → hard fail (BulkAssignError, no rows created).
 *  - Inactive batches → skipped with a failure row (continue with the rest).
 *  - Per-batch createAssignment errors → captured as failure rows; the loop
 *    continues so a single bad batch doesn't abort the whole burst.
 */
import { prisma } from "@/lib/db";
import {
  createAssignment,
  type NotifyChannel,
} from "@/lib/services/assignment.service";

export type BulkAssignErrorCode = "CROSS_ORG" | "NO_BATCHES";

export class BulkAssignError extends Error {
  code: BulkAssignErrorCode;
  constructor(code: BulkAssignErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "BulkAssignError";
  }
}

export interface CreateBulkAssignmentsInput {
  orgId: number;
  actingUserId: number;
  batchIds: number[];
  testId: number;
  title?: string | null;
  instructions?: string | null;
  dueAt?: Date | null;
  notify: NotifyChannel[];
}

export interface BulkAssignFailure {
  batchId: number;
  batchName?: string | null;
  error: string;
}

export interface BulkAssignResult {
  successCount: number;
  failures: BulkAssignFailure[];
  assignments: Array<{ batchId: number; assignmentId: number }>;
}

export async function createBulkAssignments(
  input: CreateBulkAssignmentsInput,
): Promise<BulkAssignResult> {
  const uniqueIds = Array.from(new Set(input.batchIds));
  if (uniqueIds.length === 0) {
    throw new BulkAssignError("NO_BATCHES", "No batches selected.");
  }

  // Load all batches once, validate org scope, then iterate.
  const batches = await prisma.batch.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, name: true, orgId: true, isActive: true },
  });
  const byId = new Map(batches.map((b) => [b.id, b]));

  // Cross-org check is a hard fail — refuse to create ANY rows if even one
  // batch belongs to a different org. This protects against a forged client
  // payload trying to spray assignments across tenants.
  for (const id of uniqueIds) {
    const b = byId.get(id);
    if (!b || b.orgId !== input.orgId) {
      throw new BulkAssignError(
        "CROSS_ORG",
        `Batch ${id} is not part of this organisation.`,
      );
    }
  }

  const failures: BulkAssignFailure[] = [];
  const assignments: Array<{ batchId: number; assignmentId: number }> = [];

  for (const id of uniqueIds) {
    const b = byId.get(id)!;
    if (!b.isActive) {
      failures.push({
        batchId: id,
        batchName: b.name,
        error: "Batch is archived — skipped.",
      });
      continue;
    }
    try {
      const r = await createAssignment({
        orgId: input.orgId,
        batchId: id,
        testId: input.testId,
        title: input.title ?? null,
        instructions: input.instructions ?? null,
        dueAt: input.dueAt ?? null,
        notify: input.notify,
        assignedBy: input.actingUserId,
      });
      assignments.push({ batchId: id, assignmentId: r.assignmentId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't assign to this batch.";
      failures.push({ batchId: id, batchName: b.name, error: msg });
    }
  }

  return {
    successCount: assignments.length,
    failures,
    assignments,
  };
}
