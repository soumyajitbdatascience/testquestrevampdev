/**
 * Batch service — operations on tq_batches + related coaching tables.
 *
 * Used by the /coaching/setup wizard (Task 1.4) and the future
 * /coaching/batches/* admin pages (Task 1.7+).
 *
 * Cross-table writes (Batch + BatchEnrollment + OrgMembership) wrap in a
 * Prisma $transaction so partial failures don't leave orphan rows.
 */
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { createLegacyStudent } from "@/lib/legacy-students";
import { OrgRole, Prisma } from "@/generated/prisma/client";

export class BatchError extends Error {
  code:
    | "CROSS_ORG"
    | "NOT_ENROLLED"
    | "ALREADY_THERE"
    | "SAME_BATCH"
    | "BATCH_NOT_FOUND";
  constructor(code: BatchError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export interface TransferStudentInput {
  studentId: number;
  fromBatchId: number;
  toBatchId: number;
  actingUserId: number;
  actingOrgId: number;
}

/**
 * Transfer a student from one batch to another within the same org.
 *
 * Preserves history: the old enrollment row is soft-deleted (`isActive=false`)
 * rather than deleted. Assignment attempt history in `main_exam_status` /
 * `main_exam_result` is keyed by `student_id` (not batch), so it remains
 * linked to the student automatically.
 *
 * Edge case: if the target batch has a previously soft-deleted row for this
 * student (the `(batchId, studentId)` unique constraint prevents inserting a
 * new row), we reactivate that row and bump `enrolledAt` to now.
 */
export async function transferStudent(
  input: TransferStudentInput,
): Promise<{ transferred: true }> {
  const { studentId, fromBatchId, toBatchId, actingOrgId } = input;

  if (fromBatchId === toBatchId) {
    throw new BatchError("SAME_BATCH", "Source and target batches are the same.");
  }

  const [fromBatch, toBatch] = await Promise.all([
    prisma.batch.findUnique({ where: { id: fromBatchId }, select: { orgId: true } }),
    prisma.batch.findUnique({ where: { id: toBatchId }, select: { orgId: true } }),
  ]);
  if (!fromBatch || !toBatch) {
    throw new BatchError("BATCH_NOT_FOUND", "Batch not found.");
  }
  if (fromBatch.orgId !== actingOrgId || toBatch.orgId !== actingOrgId) {
    throw new BatchError(
      "CROSS_ORG",
      "Both batches must belong to your organisation.",
    );
  }

  const fromEnrollment = await prisma.batchEnrollment.findUnique({
    where: { batchId_studentId: { batchId: fromBatchId, studentId } },
  });
  if (!fromEnrollment || !fromEnrollment.isActive) {
    throw new BatchError(
      "NOT_ENROLLED",
      "Student is not currently enrolled in the source batch.",
    );
  }

  const toEnrollment = await prisma.batchEnrollment.findUnique({
    where: { batchId_studentId: { batchId: toBatchId, studentId } },
  });
  if (toEnrollment && toEnrollment.isActive) {
    throw new BatchError(
      "ALREADY_THERE",
      "Student is already enrolled in the target batch.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.batchEnrollment.update({
      where: { id: fromEnrollment.id },
      data: { isActive: false },
    });
    if (toEnrollment) {
      // Re-activate soft-deleted row to respect the (batchId, studentId) unique key.
      await tx.batchEnrollment.update({
        where: { id: toEnrollment.id },
        data: { isActive: true, enrolledAt: new Date() },
      });
    } else {
      await tx.batchEnrollment.create({
        data: { batchId: toBatchId, studentId, isActive: true },
      });
    }
  });

  return { transferred: true };
}

export interface CreateBatchInput {
  orgId: number;
  name: string;
  classId: number;
  board: string;
  subjects: string[];
}

export async function createBatch(input: CreateBatchInput) {
  return prisma.batch.create({
    data: {
      orgId: input.orgId,
      name: input.name,
      classId: input.classId,
      board: input.board,
      subjectsCsv: input.subjects.join(","),
    },
  });
}

export interface RosterEntry {
  name: string;
  mobile: string;
  email?: string;
}

export interface AddStudentsResult {
  enrolled: Array<{ studentId: number; name: string; created: boolean }>;
  skipped: Array<{ name: string; reason: string }>;
}

/**
 * Enroll a list of students in a batch.
 *
 * For each entry:
 *  - Look up legacy `student` by email (if provided) or mobile (if no email).
 *  - If not found, create the legacy student row (no password — Task 1.5 will
 *    handle OTP-based onboarding for student-side login).
 *  - Idempotently create BatchEnrollment (CASCADE on batchId).
 *  - Idempotently create OrgMembership (role=STUDENT).
 *
 * Mobile-collision dedup is intentionally lightweight here; Task 1.5 owns the
 * full mobile-matching semantics for the public join flow.
 */
export async function addStudentsToBatch(
  orgId: number,
  batchId: number,
  roster: RosterEntry[],
): Promise<AddStudentsResult> {
  const result: AddStudentsResult = { enrolled: [], skipped: [] };

  for (const entry of roster) {
    if (!entry.name?.trim() || !entry.mobile?.trim()) {
      result.skipped.push({ name: entry.name || "(unnamed)", reason: "missing name or mobile" });
      continue;
    }

    // 1. Resolve or create legacy student.
    let studentId: number | null = null;
    let created = false;
    if (entry.email) {
      const byEmail = await prisma.$queryRaw<Array<{ id: number }>>`
        SELECT student_id AS id FROM student WHERE email_address = ${entry.email.toLowerCase()} LIMIT 1
      `;
      if (byEmail.length) studentId = byEmail[0].id;
    }
    if (!studentId) {
      // For students without provided email, synthesise a unique placeholder so the
      // legacy table's NOT NULL email column stays satisfied. Format keeps the
      // mobile visible for debugging.
      const syntheticEmail = entry.email?.toLowerCase()
        ?? `roster-${entry.mobile}@testquest.local`;
      studentId = await createLegacyStudent({
        name: entry.name.trim(),
        email: syntheticEmail,
        mobile: entry.mobile.trim(),
        passwordHash: null,
        classId: null,
        board: null,
      });
      created = true;
    }

    // 2. Enrollment + membership (idempotent via unique constraints).
    await prisma.$transaction(async (tx) => {
      const enrollExisting = await tx.batchEnrollment.findUnique({
        where: { batchId_studentId: { batchId, studentId: studentId! } },
      }).catch(() => null);
      if (!enrollExisting) {
        await tx.batchEnrollment.create({ data: { batchId, studentId: studentId! } });
      }
      const membershipExisting = await tx.orgMembership.findUnique({
        where: { orgId_userId_role: { orgId, userId: studentId!, role: OrgRole.STUDENT } },
      }).catch(() => null);
      if (!membershipExisting) {
        await tx.orgMembership.create({ data: { orgId, userId: studentId!, role: OrgRole.STUDENT } });
      }
    });

    result.enrolled.push({ studentId, name: entry.name.trim(), created });
  }

  return result;
}

export interface IssueInviteTokenInput {
  orgId: number;
  batchId: number;
  createdBy: number;
  validityDays?: number; // default 30
}

export async function issueInviteToken(input: IssueInviteTokenInput) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (input.validityDays ?? 30));
  const token = crypto.randomBytes(32).toString("hex"); // 64-char hex
  const row = await prisma.inviteToken.create({
    data: {
      token,
      batchId: input.batchId,
      orgId: input.orgId,
      createdBy: input.createdBy,
      expiresAt,
    },
  });
  return row;
}

export interface SetupProgress {
  currentStep: number;
  completedSteps: number[];
  draft?: {
    branding?: { displayName?: string; city?: string; primaryColor?: string; logoUrl?: string };
    classes?: { boards: string[]; classIds: number[] };
    batch?: { id?: number; name: string; classId: number; board: string; subjects: string[] };
  };
}

/**
 * Read `setupProgress` from Organization.brandingJson.
 *
 * The wizard host calls this on page load to know which step to start on,
 * and the per-step API handlers call it before merging in their own updates.
 */
export async function readSetupProgress(orgId: number): Promise<SetupProgress> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { brandingJson: true },
  });
  const branding = (org?.brandingJson ?? {}) as { setupProgress?: SetupProgress };
  return branding.setupProgress ?? { currentStep: 1, completedSteps: [] };
}

export async function writeSetupProgress(orgId: number, next: Partial<SetupProgress>) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { brandingJson: true },
  });
  const current = (org?.brandingJson ?? {}) as Record<string, unknown> & { setupProgress?: SetupProgress };
  const merged: SetupProgress = {
    currentStep: next.currentStep ?? current.setupProgress?.currentStep ?? 1,
    completedSteps: Array.from(new Set([...(current.setupProgress?.completedSteps ?? []), ...(next.completedSteps ?? [])])),
    draft: { ...(current.setupProgress?.draft ?? {}), ...(next.draft ?? {}) },
  };
  await prisma.organization.update({
    where: { id: orgId },
    data: { brandingJson: { ...current, setupProgress: merged } as unknown as Prisma.InputJsonValue },
  });
  return merged;
}

/**
 * Onboarding tooltip dismissal flag. Set when the owner first dismisses the
 * dashboard intro callout; checked on every dashboard render to decide whether
 * to show the OnboardingTip overlay (Task 1.12 §F).
 */
export async function readOnboardingDismissed(orgId: number): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { brandingJson: true },
  });
  const branding = (org?.brandingJson ?? {}) as { onboardingDismissed?: boolean };
  return branding.onboardingDismissed === true;
}

export async function markOnboardingDismissed(orgId: number) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { brandingJson: true },
  });
  if (!org) return;
  const current = (org.brandingJson ?? {}) as Record<string, unknown>;
  await prisma.organization.update({
    where: { id: orgId },
    data: { brandingJson: { ...current, onboardingDismissed: true } as unknown as Prisma.InputJsonValue },
  });
}

export async function clearSetupProgress(orgId: number) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { brandingJson: true },
  });
  if (!org) return;
  const { setupProgress: _drop, ...rest } = (org.brandingJson ?? {}) as Record<string, unknown> & { setupProgress?: SetupProgress };
  void _drop;
  await prisma.organization.update({
    where: { id: orgId },
    data: { brandingJson: rest as unknown as Prisma.InputJsonValue },
  });
}
