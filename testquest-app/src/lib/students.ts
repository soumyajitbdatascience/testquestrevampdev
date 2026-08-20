/**
 * Student read/write against `tq_students` — the new decoupled DB.
 *
 * Replaces `legacy-students.ts`, which read and wrote the legacy `student`
 * table. That table does not exist here: students start empty and signups fill
 * this one.
 *
 * Two shape changes matter to callers:
 *
 *  - **No `classId` / `board` on the student row.** Which board and class a
 *    student studies is a StudentContext (`tq_student_contexts`), and there can
 *    be more than one. `primaryContext` is the one they chose first, or the one
 *    they marked primary.
 *  - **Password resets live in `tq_email_tokens`**, not in columns on the
 *    student row, so a token can expire and be consumed independently.
 */
import crypto from "crypto";
import { prisma } from "./db";
import type { Prisma } from "@/generated/prisma/client";

export interface StudentRecord {
  id: number;
  name: string;
  email: string;
  mobile: string | null;
  passwordHash: string | null;
  googleId: string | null;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: Date;
  /** Board + class the student picked; null until onboarding sets one. */
  primaryContext: { boardId: number; classId: number } | null;
}

/** Primary context first, then oldest — the one that counts is [0]. */
const SELECT = {
  id: true, name: true, email: true, mobile: true, passwordHash: true,
  googleId: true, emailVerified: true, isActive: true, createdAt: true,
  contexts: {
    orderBy: [{ isPrimary: "desc" as const }, { id: "asc" as const }],
    take: 1,
    select: { boardId: true, classId: true },
  },
} satisfies Prisma.StudentSelect;

type Row = Prisma.StudentGetPayload<{ select: typeof SELECT }>;

function toRecord(r: Row): StudentRecord {
  return {
    id: r.id, name: r.name, email: r.email, mobile: r.mobile,
    passwordHash: r.passwordHash, googleId: r.googleId,
    emailVerified: r.emailVerified, isActive: r.isActive, createdAt: r.createdAt,
    primaryContext: r.contexts[0] ?? null,
  };
}

// ─── Find ─────────────────────────────────────────────────────────

export async function findByEmail(email: string): Promise<StudentRecord | null> {
  const row = await prisma.student.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: SELECT,
  });
  return row ? toRecord(row) : null;
}

export async function findById(studentId: number): Promise<StudentRecord | null> {
  const row = await prisma.student.findUnique({ where: { id: studentId }, select: SELECT });
  return row ? toRecord(row) : null;
}

export async function findByGoogleId(googleId: string): Promise<StudentRecord | null> {
  const row = await prisma.student.findUnique({ where: { googleId }, select: SELECT });
  return row ? toRecord(row) : null;
}

// ─── Create / update ──────────────────────────────────────────────

export interface CreateStudentInput {
  name: string;
  email: string;
  mobile?: string | null;
  passwordHash?: string | null;
  googleId?: string | null;
  /** Google accounts arrive with a verified address; email signups do not. */
  emailVerified?: boolean;
  boardId?: number | null;
  classId?: number | null;
}

export async function createStudent(input: CreateStudentInput): Promise<number> {
  const created = await prisma.student.create({
    data: {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      mobile: input.mobile ?? null,
      passwordHash: input.passwordHash ?? null,
      googleId: input.googleId ?? null,
      emailVerified: input.emailVerified ?? false,
      // A board+class pair is only meaningful together, so the context row is
      // written only when both are known.
      contexts:
        input.boardId != null && input.classId != null
          ? { create: { boardId: input.boardId, classId: input.classId, isPrimary: true } }
          : undefined,
    },
    select: { id: true },
  });
  return created.id;
}

export interface UpdateStudentInput {
  name?: string;
  mobile?: string | null;
  passwordHash?: string;
  googleId?: string | null;
  emailVerified?: boolean;
}

export async function updateStudent(studentId: number, patch: UpdateStudentInput): Promise<void> {
  const data = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  if (Object.keys(data).length === 0) return;
  await prisma.student.update({ where: { id: studentId }, data });
}

/**
 * Sets the student's board+class. Idempotent, and demotes any previous primary
 * so exactly one context is ever primary.
 */
export async function setPrimaryContext(studentId: number, boardId: number, classId: number): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.studentContext.updateMany({ where: { studentId }, data: { isPrimary: false } });
    await tx.studentContext.upsert({
      where: { studentId_boardId_classId: { studentId, boardId, classId } },
      create: { studentId, boardId, classId, isPrimary: true },
      update: { isPrimary: true },
    });
  });
}

// ─── Password reset (tq_email_tokens) ─────────────────────────────

/** Issues a reset token, invalidating any earlier unused one for the student. */
export async function createPasswordResetToken(studentId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.$transaction(async (tx) => {
    await tx.emailToken.updateMany({
      where: { studentId, type: "RESET", usedAt: null },
      data: { usedAt: new Date() },
    });
    await tx.emailToken.create({ data: { studentId, token, type: "RESET", expiresAt } });
  });
  return token;
}

/**
 * Issues an email-verification token, invalidating any earlier unused one.
 * Longer-lived than a reset: verification isn't urgent and a link that dies
 * overnight just makes people ask for another.
 */
export async function createVerificationToken(studentId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.$transaction(async (tx) => {
    await tx.emailToken.updateMany({
      where: { studentId, type: "VERIFY", usedAt: null },
      data: { usedAt: new Date() },
    });
    await tx.emailToken.create({ data: { studentId, token, type: "VERIFY", expiresAt } });
  });
  return token;
}

export async function findResetToken(
  token: string,
): Promise<{ studentId: number; email: string; name: string } | null> {
  const row = await prisma.emailToken.findUnique({ where: { token } });
  if (!row || row.type !== "RESET" || row.usedAt || row.expiresAt < new Date()) return null;
  const student = await prisma.student.findUnique({
    where: { id: row.studentId },
    select: { id: true, email: true, name: true },
  });
  if (!student) return null;
  return { studentId: student.id, email: student.email, name: student.name };
}

/**
 * Consumes a reset token and sets the new password. Returns false for a token
 * that is unknown, expired or already used — the caller must not distinguish
 * between those cases to the user.
 */
export async function consumePasswordResetToken(token: string, newPasswordHash: string): Promise<boolean> {
  const row = await prisma.emailToken.findUnique({ where: { token } });
  if (!row || row.type !== "RESET" || row.usedAt || row.expiresAt < new Date()) return false;

  await prisma.$transaction([
    prisma.emailToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.student.update({ where: { id: row.studentId }, data: { passwordHash: newPasswordHash } }),
  ]);
  return true;
}
