/**
 * Read/write the legacy `student` table.
 *
 * Web signup, login, profile updates all go through here so:
 *   - Existing mobile users can log in to the web with their phone-app credentials
 *   - New web signups appear in the mobile app's user base
 *   - The student_id on attempts is a legacy ID, naturally referenced by main_exam_status
 *
 * `password` column holds bcrypt hash (some legacy rows are plaintext — those
 * users cannot log in until they request a reset).
 */
import { prisma } from "./db";
import crypto from "crypto";

export interface LegacyStudent {
  id: number;
  name: string;
  email: string;
  mobile: string | null;
  passwordHash: string | null;
  classId: number | null;
  board: string | null;
  avatarUrl: string | null;
  isActive: boolean;
}

function composeName(first?: string | null, second?: string | null, surname?: string | null, fallback?: string | null): string {
  const parts = [first, second, surname].map(p => (p || "").trim()).filter(Boolean);
  return parts.join(" ") || fallback?.trim() || "Student";
}

function splitName(full: string): { first: string; surname: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], surname: "" };
  return { first: parts[0], surname: parts.slice(1).join(" ") };
}

function generateAccountNumber(): string {
  // Random 12-digit-ish unique key — used by legacy for wallet account too
  return Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, "0");
}

// ─── Find ─────────────────────────────────────────────────────────

export async function findByEmail(email: string): Promise<LegacyStudent | null> {
  const e = email.trim().toLowerCase();
  const rows = await prisma.$queryRaw<Array<{
    student_id: number; first_name: string | null; second_name: string | null; surname_name: string | null;
    email_address: string; mobile_no: string | null; password: string | null;
    category_id: number | null; avatar: string | null; status: number;
  }>>`
    SELECT student_id, first_name, second_name, surname_name,
           email_address, mobile_no, password, category_id, avatar, status
    FROM student WHERE LOWER(email_address) = ${e} LIMIT 1
  `;
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id: r.student_id,
    name: composeName(r.first_name, r.second_name, r.surname_name, r.email_address),
    email: r.email_address,
    mobile: r.mobile_no,
    passwordHash: r.password,
    classId: r.category_id,
    board: null, // legacy stores board info in subcategories — leaving null for MVP
    avatarUrl: r.avatar,
    isActive: r.status === 1,
  };
}

export async function findById(studentId: number): Promise<LegacyStudent | null> {
  const rows = await prisma.$queryRaw<Array<{
    student_id: number; first_name: string | null; second_name: string | null; surname_name: string | null;
    email_address: string; mobile_no: string | null; password: string | null;
    category_id: number | null; avatar: string | null; status: number;
  }>>`
    SELECT student_id, first_name, second_name, surname_name,
           email_address, mobile_no, password, category_id, avatar, status
    FROM student WHERE student_id = ${studentId} LIMIT 1
  `;
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id: r.student_id,
    name: composeName(r.first_name, r.second_name, r.surname_name, r.email_address),
    email: r.email_address,
    mobile: r.mobile_no,
    passwordHash: r.password,
    classId: r.category_id,
    board: null,
    avatarUrl: r.avatar,
    isActive: r.status === 1,
  };
}

// ─── Create ───────────────────────────────────────────────────────

interface CreateStudentInput {
  name: string;
  email: string;
  mobile?: string | null;
  passwordHash?: string | null; // null for Google-only accounts
  classId?: number | null;
  board?: string | null;
  avatarUrl?: string | null;
}

/**
 * Insert a new row in legacy `student`. Returns the new student_id.
 */
export async function createLegacyStudent(input: CreateStudentInput): Promise<number> {
  const { first, surname } = splitName(input.name);
  const email = input.email.trim().toLowerCase();
  const account = generateAccountNumber();
  const now = new Date();

  // Default to English language id 3 for new web users
  await prisma.$executeRawUnsafe(
    `INSERT INTO student (
       category_id, subcategories_id, first_name, second_name, surname_name,
       mobile_no, email_address, username,
       password, encrypt_password,
       status, payment_status,
       student_language_default_name, student_language_default_code,
       student_language_default_id, student_language_default_directory,
       registration_date, account_number, mail_activation, avatar
     ) VALUES (
       ?, 0, ?, '', ?,
       ?, ?, ?,
       ?, '',
       1, 0,
       'English', 'EN',
       3, 'english',
       ?, ?, 1, ?
     )`,
    input.classId ?? 0, first, surname,
    input.mobile ?? "", email, email.split("@")[0],
    input.passwordHash ?? "",
    now, account, input.avatarUrl ?? ""
  );

  const rows = await prisma.$queryRaw<Array<{ student_id: number }>>`
    SELECT student_id FROM student WHERE email_address = ${email} ORDER BY student_id DESC LIMIT 1
  `;
  return Number(rows[0]?.student_id ?? 0);
}

// ─── Update ───────────────────────────────────────────────────────

interface UpdateStudentInput {
  name?: string;
  mobile?: string | null;
  classId?: number | null;
  passwordHash?: string;
  avatarUrl?: string | null;
}

export async function updateLegacyStudent(studentId: number, patch: UpdateStudentInput): Promise<void> {
  const sets: string[] = [];
  const args: (string | number | null)[] = [];

  if (patch.name !== undefined) {
    const { first, surname } = splitName(patch.name);
    sets.push("first_name = ?"); args.push(first);
    sets.push("surname_name = ?"); args.push(surname);
  }
  if (patch.mobile !== undefined) { sets.push("mobile_no = ?"); args.push(patch.mobile); }
  if (patch.classId !== undefined) { sets.push("category_id = ?"); args.push(patch.classId); }
  if (patch.passwordHash !== undefined) { sets.push("password = ?"); args.push(patch.passwordHash); }
  if (patch.avatarUrl !== undefined) { sets.push("avatar = ?"); args.push(patch.avatarUrl); }

  if (sets.length === 0) return;
  args.push(studentId);
  await prisma.$executeRawUnsafe(
    `UPDATE student SET ${sets.join(", ")} WHERE student_id = ?`,
    ...args
  );
}

// ─── Password reset support ───────────────────────────────────────

export async function setPasswordResetToken(email: string, token: string, expires: Date): Promise<boolean> {
  const e = email.trim().toLowerCase();
  const res = await prisma.$executeRawUnsafe(
    `UPDATE student SET password_reset_token = ?, password_reset_expires = ? WHERE LOWER(email_address) = ?`,
    token, expires, e
  );
  return Number(res) > 0;
}

export async function consumePasswordResetToken(token: string, newPasswordHash: string): Promise<boolean> {
  const r = await consumePasswordResetTokenDetailed(token, newPasswordHash);
  return r != null;
}

/**
 * Same as `consumePasswordResetToken` but returns the affected studentId
 * on success. Phase 2 / Task 2.5 introduced the welcome flow that needs the
 * id to mint a JWT; the boolean helper above stays for backwards-compat with
 * the existing /reset-password page.
 */
export async function consumePasswordResetTokenDetailed(
  token: string,
  newPasswordHash: string,
): Promise<{ studentId: number } | null> {
  const rows = await prisma.$queryRaw<Array<{ student_id: number; password_reset_expires: Date | null }>>`
    SELECT student_id, password_reset_expires FROM student
    WHERE password_reset_token = ${token} LIMIT 1
  `;
  if (!rows[0]) return null;
  if (!rows[0].password_reset_expires || rows[0].password_reset_expires < new Date()) return null;

  await prisma.$executeRawUnsafe(
    `UPDATE student SET password = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE student_id = ?`,
    newPasswordHash, rows[0].student_id
  );
  return { studentId: rows[0].student_id };
}

/** Lookup an active reset/welcome token. Used by the welcome accept page so
 *  it can render the owner's name + org before they submit a password. */
export async function findResetToken(token: string): Promise<{ studentId: number; email: string; name: string } | null> {
  const rows = await prisma.$queryRaw<Array<{
    student_id: number; email_address: string; first_name: string; surname_name: string;
    password_reset_expires: Date | null;
  }>>`
    SELECT student_id, email_address, first_name, surname_name, password_reset_expires
    FROM student
    WHERE password_reset_token = ${token} LIMIT 1
  `;
  if (!rows[0]) return null;
  if (!rows[0].password_reset_expires || rows[0].password_reset_expires < new Date()) return null;
  const name = [rows[0].first_name, rows[0].surname_name].filter(Boolean).join(" ").trim();
  return {
    studentId: Number(rows[0].student_id),
    email: rows[0].email_address,
    name: name || "there",
  };
}
