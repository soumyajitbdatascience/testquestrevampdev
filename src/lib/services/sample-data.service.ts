/**
 * Sample-data service — Task 5.4.
 *
 * On trial signup we optionally seed one demo batch with 10 fake students and
 * 1 sample assignment so a brand-new owner can click around without first
 * importing real data. The owner can blow it all away with one button on the
 * dashboard.
 *
 * State is tracked on `Organization.brandingJson.sampleData` rather than via
 * a dedicated table — the rollout is small enough that a JSON marker is
 * sufficient, and it keeps the schema unchanged (Task 5.4 has no migrations).
 *
 * Class choice: classId 25 (Pre-Foundation) over 27 (JEE MAINS). Pre-Foundation
 * has a smaller question bank but a wider variety of free tests, so owners see
 * sensible content regardless of their actual subject mix. JEE-only owners can
 * delete the demo and create their own batch in seconds.
 *
 * All operations are idempotent — seeding a second time when a marker exists
 * is a no-op and returns the existing ids.
 */
import { prisma } from "@/lib/db";
import { createLegacyStudent } from "@/lib/legacy-students";
import { createAssignment } from "@/lib/services/assignment.service";
import { OrgRole, Prisma } from "@/generated/prisma/client";

/** JSON marker stored on `Organization.brandingJson.sampleData`. */
export interface SampleDataMarker {
  batchId: number;
  studentIds: number[];
  assignmentId: number;
  createdAt: string; // ISO
}

const DEMO_CLASS_ID = 25;            // Pre-Foundation; see header note.
const DEMO_BOARD = "CBSE";
const DEMO_BATCH_NAME = "Demo class — try assigning a test";

const DEMO_STUDENT_NAMES = [
  "Arjun Patel",
  "Priya Sharma",
  "Rohit Kumar",
  "Sneha Iyer",
  "Vikram Reddy",
  "Anita Mehta",
  "Kiran Joshi",
  "Pooja Singh",
  "Rahul Verma",
  "Maya Nair",
] as const;

interface BrandingShape {
  sampleData?: SampleDataMarker;
  [k: string]: unknown;
}

async function readBranding(orgId: number): Promise<BrandingShape> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { brandingJson: true },
  });
  return (org?.brandingJson ?? {}) as BrandingShape;
}

async function writeBranding(orgId: number, next: BrandingShape): Promise<void> {
  await prisma.organization.update({
    where: { id: orgId },
    data: { brandingJson: next as unknown as Prisma.InputJsonValue },
  });
}

/**
 * Locate the first free, active test in the demo class that we can assign.
 * Returns null if no suitable test exists (caller will skip the assignment).
 */
async function findDemoTestId(classId: number): Promise<number | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `SELECT t.id FROM vw_tests t
     WHERE t.isActive = TRUE AND t.classId = ?
       AND (SELECT COUNT(*) FROM vw_test_questions q WHERE q.testId = t.id) > 0
     ORDER BY t.isFree DESC, t.id ASC
     LIMIT 1`,
    classId,
  );
  if (!rows.length) return null;
  return Number(rows[0].id);
}

export async function getSampleData(orgId: number): Promise<SampleDataMarker | null> {
  const branding = await readBranding(orgId);
  return branding.sampleData ?? null;
}

export interface SeedSampleDataInput {
  orgId: number;
  createdBy: number;
}

/**
 * Seed one demo batch + 10 fake students + 1 sample assignment for `orgId`.
 * Idempotent — if a marker already exists, returns the existing ids without
 * touching the DB.
 */
export async function seedSampleData(
  input: SeedSampleDataInput,
): Promise<{ batchId: number; studentIds: number[]; assignmentId: number }> {
  const existing = await getSampleData(input.orgId);
  if (existing) {
    return {
      batchId: existing.batchId,
      studentIds: existing.studentIds,
      assignmentId: existing.assignmentId,
    };
  }

  // 1. Demo batch.
  const batch = await prisma.batch.create({
    data: {
      orgId: input.orgId,
      name: DEMO_BATCH_NAME,
      classId: DEMO_CLASS_ID,
      board: DEMO_BOARD,
      subjectsCsv: "",
    },
  });

  // 2. 10 legacy students with org-scoped emails — collisions across orgs
  // are impossible because the email pattern embeds `orgId`.
  const studentIds: number[] = [];
  for (let i = 0; i < DEMO_STUDENT_NAMES.length; i++) {
    const name = DEMO_STUDENT_NAMES[i];
    const email = `demo-${input.orgId}-${i + 1}@sample.testquest.local`;
    const studentId = await createLegacyStudent({
      name,
      email,
      mobile: "",
      passwordHash: "",
      classId: DEMO_CLASS_ID,
      board: null,
    });
    studentIds.push(studentId);
  }

  // 3. Enrollments + org memberships (mirrors batch.service:addStudentsToBatch).
  for (const studentId of studentIds) {
    await prisma.batchEnrollment.create({
      data: { batchId: batch.id, studentId },
    });
    const existingMembership = await prisma.orgMembership.findUnique({
      where: { orgId_userId_role: { orgId: input.orgId, userId: studentId, role: OrgRole.STUDENT } },
    }).catch(() => null);
    if (!existingMembership) {
      await prisma.orgMembership.create({
        data: { orgId: input.orgId, userId: studentId, role: OrgRole.STUDENT },
      });
    }
  }

  // 4. Sample assignment using the first usable test in the demo class.
  // notify: [] — don't fire SMS/email to the fake students.
  const testId = await findDemoTestId(DEMO_CLASS_ID);
  let assignmentId = 0;
  if (testId) {
    const result = await createAssignment({
      orgId: input.orgId,
      batchId: batch.id,
      testId,
      title: "Sample assignment — delete me when you're ready",
      instructions: "This is a demo assignment so you can see how the flow feels. Delete the demo data when you bring real students in.",
      notify: [],
      assignedBy: input.createdBy,
      dueAt: null,
    });
    assignmentId = result.assignmentId;
  }

  // 5. Persist marker on brandingJson, merging with whatever else lives there.
  const branding = await readBranding(input.orgId);
  const marker: SampleDataMarker = {
    batchId: batch.id,
    studentIds,
    assignmentId,
    createdAt: new Date().toISOString(),
  };
  await writeBranding(input.orgId, { ...branding, sampleData: marker });

  return { batchId: batch.id, studentIds, assignmentId };
}

export interface RemoveSampleDataResult {
  deletedBatch: number;     // 0 or 1
  deletedStudents: number;  // count actually soft-deleted
  deletedAssignment: number;// 0 or 1
}

/**
 * Targeted teardown of whatever the marker references. Idempotent: if the
 * marker is missing, returns zero counts. Only flips status on the exact
 * student IDs we created — never touches anything else.
 */
export async function removeSampleData(orgId: number): Promise<RemoveSampleDataResult> {
  const branding = await readBranding(orgId);
  const marker = branding.sampleData;
  if (!marker) {
    return { deletedBatch: 0, deletedStudents: 0, deletedAssignment: 0 };
  }

  let deletedBatch = 0;
  let deletedStudents = 0;
  let deletedAssignment = 0;

  // Soft-delete the assignment first (its FK target — the batch — is about to
  // flip inactive, but we keep the row for audit; just mark it inactive).
  if (marker.assignmentId) {
    const upd = await prisma.assignment.updateMany({
      where: { id: marker.assignmentId, orgId, isActive: true },
      data: { isActive: false },
    });
    deletedAssignment = upd.count;
  }

  // Soft-delete the batch — enrollments stay in the DB but the batch is
  // hidden from the dashboard via isActive filters.
  if (marker.batchId) {
    const upd = await prisma.batch.updateMany({
      where: { id: marker.batchId, orgId, isActive: true },
      data: { isActive: false },
    });
    deletedBatch = upd.count;
  }

  // Soft-delete each sample student in legacy `student` — status = 0.
  if (marker.studentIds.length > 0) {
    const placeholders = marker.studentIds.map(() => "?").join(",");
    const res = await prisma.$executeRawUnsafe(
      `UPDATE student SET status = 0 WHERE status = 1 AND student_id IN (${placeholders})`,
      ...marker.studentIds,
    );
    deletedStudents = Number(res);
  }

  // Clear marker from brandingJson but preserve every other key.
  const { sampleData: _drop, ...rest } = branding;
  void _drop;
  await writeBranding(orgId, rest);

  return { deletedBatch, deletedStudents, deletedAssignment };
}
