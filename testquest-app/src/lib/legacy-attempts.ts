/**
 * Read/write attempts against the legacy `main_exam_status` + `main_exam_result`
 * (and practice variants). Writes to these tables so the mobile app sees
 * web attempts and vice-versa.
 *
 * Attempt-ID encoding:
 *   main attempts:     id = main_exam_status.id
 *   practice attempts: id = practice_exam_status.id + 1_000_000
 *
 * Test-ID encoding (matches vw_tests): same +1M offset for practice.
 *
 * Answer encoding follows the legacy position-list format:
 *   single-choice option C correct → "3" or ",,3,,,"
 *   multi-choice options A+C       → "1,3" or "1,,3,,,"
 */
import { prisma } from "./db";
import crypto from "crypto";

export const PRACTICE_OFFSET = 1_000_000;

/** A "kind" indicator distinguishing main vs practice exam paths. */
export type ExamKind = "main" | "practice";

/** Decode an exposed testId into the legacy table + DB id. */
export function decodeTestId(testId: number): { kind: ExamKind; dbId: number } {
  if (testId >= PRACTICE_OFFSET) return { kind: "practice", dbId: testId - PRACTICE_OFFSET };
  return { kind: "main", dbId: testId };
}

/** Decode an exposed attemptId into the legacy table + DB id. */
export function decodeAttemptId(attemptId: number): { kind: ExamKind; dbId: number } {
  if (attemptId >= PRACTICE_OFFSET) return { kind: "practice", dbId: attemptId - PRACTICE_OFFSET };
  return { kind: "main", dbId: attemptId };
}

/** SHA1-style token, 40 hex chars — matches existing legacy format. */
export function generateToken(): string {
  return crypto.randomBytes(20).toString("hex");
}

/**
 * Convert a list of 1-based positions (e.g. [3]) to the legacy CSV string ",,3,,,".
 * Six slots even if not all positions are used — matches legacy convention.
 */
export function positionsToLegacy(positions: number[], maxOptions = 6): string {
  const set = new Set(positions);
  const out: string[] = [];
  for (let i = 1; i <= maxOptions; i++) {
    out.push(set.has(i) ? String(i) : "");
  }
  return out.join(",");
}

/**
 * Parse legacy correct_answer or user_answer to a set of 1-based positions.
 * Handles both "3" and ",,3,,,".
 */
export function parseLegacyAnswer(s: string | null | undefined): number[] {
  if (!s) return [];
  return s
    .split(",")
    .map(x => x.trim())
    .filter(x => x !== "" && !Number.isNaN(Number(x)))
    .map(Number)
    .filter(n => n >= 1 && n <= 6);
}

interface ExamRow {
  exam_id: number;
  category_id: number;
  subcategories_id?: number;
  subcategory_id?: number;
  subject_choose: string;
  subject_id: string;
  exam_duration: number;
  passing_percentage?: number | string;
  neg_mark_status?: number;
  negative_marks?: number | string;
}

interface ExamTables {
  examTable: "main_exam" | "practice_exam";
  examLinkTable: "main_exam_to_question" | "practice_exam_to_question";
  statusTable: "main_exam_status" | "practice_exam_status";
  resultTable: "main_exam_result" | "practice_exam_result";
  statusIdCol: "main_exam_status_id" | "practice_exam_status_id";
}

function tablesFor(kind: ExamKind): ExamTables {
  if (kind === "practice") {
    return {
      examTable: "practice_exam",
      examLinkTable: "practice_exam_to_question",
      statusTable: "practice_exam_status",
      resultTable: "practice_exam_result",
      statusIdCol: "practice_exam_status_id",
    };
  }
  return {
    examTable: "main_exam",
    examLinkTable: "main_exam_to_question",
    statusTable: "main_exam_status",
    resultTable: "main_exam_result",
    statusIdCol: "main_exam_status_id",
  };
}

/** Fetch the master exam row. */
async function fetchExam(kind: ExamKind, dbId: number): Promise<ExamRow | null> {
  const t = tablesFor(kind);
  const rows = await prisma.$queryRawUnsafe<ExamRow[]>(
    `SELECT * FROM \`${t.examTable}\` WHERE exam_id = ? LIMIT 1`,
    dbId
  );
  return rows[0] || null;
}

/** Compute total marks + total questions for an exam. */
async function examTotals(kind: ExamKind, dbId: number): Promise<{ totalMarks: number; totalQuestions: number }> {
  const t = tablesFor(kind);
  const r = await prisma.$queryRawUnsafe<Array<{ totalMarks: number | bigint; cnt: bigint }>>(
    `SELECT COALESCE(SUM(Marks), 0) AS totalMarks, COUNT(*) AS cnt
     FROM \`${t.examLinkTable}\` WHERE exam_id = ?`,
    dbId
  );
  return { totalMarks: Number(r[0]?.totalMarks ?? 0), totalQuestions: Number(r[0]?.cnt ?? 0) };
}

// ─── Start ────────────────────────────────────────────────────────

export interface AttemptSummary {
  attemptId: number;
  token: string;
  testId: number;
  studentId: number;
  status: 1 | 2;
  isPractice: boolean;
  totalMarks: number;
  totalQuestions: number;
  startedAt: Date;
}

export async function startAttempt(studentId: number, testId: number): Promise<AttemptSummary> {
  const { kind, dbId } = decodeTestId(testId);
  const t = tablesFor(kind);
  const exam = await fetchExam(kind, dbId);
  if (!exam) throw new Error("Test not found");

  const { totalMarks, totalQuestions } = await examTotals(kind, dbId);
  const token = generateToken();
  const now = new Date();

  // Number of attempts so far for this student/exam (for noofattemps)
  const prior = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
    `SELECT COUNT(*) AS cnt FROM \`${t.statusTable}\` WHERE student_id = ? AND exam_id = ?`,
    studentId, dbId
  );
  const noofattemps = Number(prior[0]?.cnt ?? 0) + 1;

  const subcategoryCol = kind === "main" ? "subcategory_id" : "subcategory_id";
  const subcategoryVal = (exam.subcategories_id ?? exam.subcategory_id ?? 0);

  // INSERT into the status table — return the new id
  await prisma.$executeRawUnsafe(
    `INSERT INTO \`${t.statusTable}\` (
       category_id, ${subcategoryCol}, subject_choose, subject_id,
       exam_id, center_id, student_id, exam_date, status, noofattemps,
       user_score, passing_score, total_score, total_question,
       neg_mark_status, negative_mark, ${kind === "main" ? "negative_marks_total," : ""}
       wrong_answer, correct_answer, ${kind === "main" ? "correct_answer_marks," : ""}
       nogiven_answer, exam_start_time, exam_finish_time, exam_finish_time_duplicate,
       on_exam_spend_time_by_children, exam_finish_time_by_children, student_rank, token
     ) VALUES (
       ?, ?, ?, ?,
       ?, 0, ?, ?, 1, ?,
       '0', ?, ?, ?,
       ?, ?, ${kind === "main" ? "'0'," : ""}
       0, 0, ${kind === "main" ? "'0'," : ""}
       ?, ?, ?, ?,
       ?, ?, 0, ?
     )`,
    exam.category_id, subcategoryVal, String(exam.subject_choose ?? ""), String(exam.subject_id ?? ""),
    dbId, studentId, now, noofattemps,
    String(exam.passing_percentage ?? "0"), String(totalMarks), totalQuestions,
    Number(exam.neg_mark_status ?? 0), Number(exam.negative_marks ?? 0),
    totalQuestions /* nogiven_answer starts equal to total */,
    now, now, now.toUTCString(),
    now.toISOString().replace("T", " ").slice(0, 19), now,
    token
  );

  // Get the just-inserted id
  const idRow = await prisma.$queryRawUnsafe<Array<{ id: bigint }>>(
    `SELECT id FROM \`${t.statusTable}\` WHERE token = ? LIMIT 1`,
    token
  );
  const dbAttemptId = Number(idRow[0]?.id ?? 0);
  const attemptId = kind === "practice" ? dbAttemptId + PRACTICE_OFFSET : dbAttemptId;

  return {
    attemptId,
    token,
    testId,
    studentId,
    status: 1,
    isPractice: kind === "practice",
    totalMarks,
    totalQuestions,
    startedAt: now,
  };
}

// ─── Read ─────────────────────────────────────────────────────────

export interface AttemptStatusRow {
  attemptId: number;
  dbId: number;
  kind: ExamKind;
  studentId: number;
  testId: number;
  status: 1 | 2;
  token: string;
  totalMarks: number;
  userScore: number;
  totalQuestions: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  timeSpentSeconds: number;
}

export async function getAttemptStatus(attemptId: number): Promise<AttemptStatusRow | null> {
  const { kind, dbId } = decodeAttemptId(attemptId);
  const t = tablesFor(kind);
  const rows = await prisma.$queryRawUnsafe<Array<{
    id: number; student_id: number; exam_id: number; status: number; token: string;
    user_score: string | number | null; total_score: string | number | null;
    total_question: number | null; exam_start_time: Date | null;
    exam_finish_time_by_children: Date | null; on_exam_spend_time_by_children: string | null;
  }>>(
    `SELECT id, student_id, exam_id, status, token,
            user_score, total_score, total_question,
            exam_start_time, exam_finish_time_by_children, on_exam_spend_time_by_children
     FROM \`${t.statusTable}\` WHERE id = ? LIMIT 1`,
    dbId
  );
  if (!rows[0]) return null;
  const r = rows[0];
  const totalMarks = Number(r.total_score ?? 0);
  const userScore = Number(r.user_score ?? 0);
  const startedAt = r.exam_start_time || null;
  const finishedAt = r.exam_finish_time_by_children || null;
  const timeSpentSeconds = startedAt && finishedAt
    ? Math.max(0, Math.round((+finishedAt - +startedAt) / 1000))
    : 0;
  return {
    attemptId,
    dbId,
    kind,
    studentId: r.student_id,
    testId: kind === "practice" ? r.exam_id + PRACTICE_OFFSET : r.exam_id,
    status: (r.status === 2 ? 2 : 1) as 1 | 2,
    token: r.token,
    totalMarks,
    userScore,
    totalQuestions: r.total_question || 0,
    startedAt,
    finishedAt,
    timeSpentSeconds,
  };
}

export interface AttemptAnswerRow {
  questionId: number;
  userAnswerPositions: number[];
  correctAnswerPositions: number[];
  result: number; // 0=unmarked, 1=correct, 2=wrong
  marks: number;
}

/** All saved answers for an attempt, identified by token. */
export async function getAttemptAnswers(kind: ExamKind, token: string): Promise<AttemptAnswerRow[]> {
  const t = tablesFor(kind);
  const rows = await prisma.$queryRawUnsafe<Array<{
    question_id: number; user_answer: string | null; correct_answer: string | null;
    result: number | null; Marks: number | null;
  }>>(
    `SELECT question_id, user_answer, correct_answer, result, Marks
     FROM \`${t.resultTable}\` WHERE token = ?`,
    token
  );
  return rows.map(r => ({
    questionId: r.question_id,
    userAnswerPositions: parseLegacyAnswer(r.user_answer),
    correctAnswerPositions: parseLegacyAnswer(r.correct_answer),
    result: r.result ?? 0,
    marks: r.Marks ?? 0,
  }));
}

// ─── Write answer ─────────────────────────────────────────────────

/**
 * Upsert a single answer in main_exam_result / practice_exam_result.
 * Looks up the correct answer + marks from the exam-link table.
 */
export async function saveAnswer(opts: {
  kind: ExamKind;
  examDbId: number;
  studentId: number;
  questionId: number;
  positions: number[];
  token: string;
  attemptDbId: number;
}): Promise<void> {
  const t = tablesFor(opts.kind);

  // Fetch correct answer + marks + subject for this exam-question pair
  const link = await prisma.$queryRawUnsafe<Array<{ correct_answer: string | null; Marks: number | null; subjects_id: number | null }>>(
    `SELECT correct_answer, Marks, subjects_id
     FROM \`${t.examLinkTable}\`
     WHERE exam_id = ? AND question_id = ? LIMIT 1`,
    opts.examDbId, opts.questionId
  );
  const correctAnswerStr = link[0]?.correct_answer || "";
  const marks = Number(link[0]?.Marks ?? 1);
  const subjectId = Number(link[0]?.subjects_id ?? 0);

  const userAnswerStr = positionsToLegacy(opts.positions);
  const correctPositions = parseLegacyAnswer(correctAnswerStr);

  // Result: 1 = correct (all positions match exactly), 2 = wrong, 0 = not answered
  let result = 0;
  if (opts.positions.length > 0) {
    const userSet = new Set(opts.positions);
    const correctSet = new Set(correctPositions);
    const same = userSet.size === correctSet.size && [...userSet].every(p => correctSet.has(p));
    result = same ? 1 : 2;
  }

  // Upsert by (token, question_id)
  const existing = await prisma.$queryRawUnsafe<Array<{ exam_result_id: number }>>(
    `SELECT exam_result_id FROM \`${t.resultTable}\` WHERE token = ? AND question_id = ? LIMIT 1`,
    opts.token, opts.questionId
  );

  const now = new Date();
  if (existing[0]) {
    await prisma.$executeRawUnsafe(
      `UPDATE \`${t.resultTable}\`
       SET user_answer = ?, correct_answer = ?, result = ?, Marks = ?, exam_given_date = ?
       WHERE exam_result_id = ?`,
      userAnswerStr, correctAnswerStr, result, marks, now, existing[0].exam_result_id
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO \`${t.resultTable}\` (
        exam_id, student_id, center_id, subjects_id, question_id, sub_question_id,
        user_answer, correct_answer, result, Marks, exam_given_date,
        ${t.statusIdCol}, token
      ) VALUES (?, ?, 0, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`,
      opts.examDbId, opts.studentId, subjectId, opts.questionId,
      userAnswerStr, correctAnswerStr, result, marks, now, opts.attemptDbId, opts.token
    );
  }
}

// ─── Submit ───────────────────────────────────────────────────────

/** Recompute totals and mark attempt completed. */
export async function submitAttempt(attemptId: number): Promise<void> {
  const { kind, dbId } = decodeAttemptId(attemptId);
  const t = tablesFor(kind);

  // Pull the token + total_question
  const stat = await prisma.$queryRawUnsafe<Array<{ token: string; total_question: number | null; exam_start_time: Date | null }>>(
    `SELECT token, total_question, exam_start_time FROM \`${t.statusTable}\` WHERE id = ?`,
    dbId
  );
  if (!stat[0]) throw new Error("Attempt not found");
  const token = stat[0].token;
  const totalQuestions = stat[0].total_question || 0;

  // Aggregate from result table
  const agg = await prisma.$queryRawUnsafe<Array<{
    correctCount: bigint; wrongCount: bigint; userScore: number | string | null; answeredCount: bigint;
  }>>(
    `SELECT
       SUM(CASE WHEN result = 1 THEN 1 ELSE 0 END) AS correctCount,
       SUM(CASE WHEN result = 2 THEN 1 ELSE 0 END) AS wrongCount,
       SUM(CASE WHEN result = 1 THEN Marks ELSE 0 END) AS userScore,
       COUNT(*) AS answeredCount
     FROM \`${t.resultTable}\` WHERE token = ?`,
    token
  );
  const correctCount = Number(agg[0]?.correctCount ?? 0);
  const wrongCount = Number(agg[0]?.wrongCount ?? 0);
  const userScore = Number(agg[0]?.userScore ?? 0);
  const answered = Number(agg[0]?.answeredCount ?? 0);
  const notGiven = Math.max(0, totalQuestions - answered);

  const now = new Date();
  await prisma.$executeRawUnsafe(
    `UPDATE \`${t.statusTable}\`
     SET status = 2,
         user_score = ?,
         correct_answer = ?, wrong_answer = ?, nogiven_answer = ?,
         exam_finish_time = ?, exam_finish_time_duplicate = ?,
         exam_finish_time_by_children = ?
     WHERE id = ?`,
    String(userScore), correctCount, wrongCount, notGiven,
    now, now.toUTCString(), now, dbId
  );
}

// ─── Pause / Resume ───────────────────────────────────────────────

export async function pauseAttempt(attemptId: number): Promise<void> {
  // Legacy has no explicit "paused" status. We'll leave status=1 and
  // record the current elapsed time in on_exam_spend_time_by_children
  // so we can resume from where we left off.
  const { kind, dbId } = decodeAttemptId(attemptId);
  const t = tablesFor(kind);
  const now = new Date();
  await prisma.$executeRawUnsafe(
    `UPDATE \`${t.statusTable}\`
     SET on_exam_spend_time_by_children = ?
     WHERE id = ?`,
    now.toISOString().replace("T", " ").slice(0, 19),
    dbId
  );
}

export async function resumeAttempt(attemptId: number): Promise<void> {
  // No-op for now; we keep status=1 the whole time. Just refresh the marker.
  const { kind, dbId } = decodeAttemptId(attemptId);
  const t = tablesFor(kind);
  const now = new Date();
  await prisma.$executeRawUnsafe(
    `UPDATE \`${t.statusTable}\`
     SET on_exam_spend_time_by_children = ?
     WHERE id = ?`,
    now.toISOString().replace("T", " ").slice(0, 19),
    dbId
  );
}

// ─── Active attempts for a student ────────────────────────────────

export async function findActiveAttemptForStudent(studentId: number, testId: number): Promise<AttemptStatusRow | null> {
  const { kind, dbId } = decodeTestId(testId);
  const t = tablesFor(kind);
  const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `SELECT id FROM \`${t.statusTable}\`
     WHERE student_id = ? AND exam_id = ? AND status = 1
     ORDER BY id DESC LIMIT 1`,
    studentId, dbId
  );
  if (!rows[0]) return null;
  const attemptId = kind === "practice" ? rows[0].id + PRACTICE_OFFSET : rows[0].id;
  return getAttemptStatus(attemptId);
}
