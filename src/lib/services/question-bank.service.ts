/**
 * question-bank service — Phase 2 / Task 2.3.
 *
 * Owns the org's private question bank:
 *   - Parses uploaded xlsx files and bulk-creates rows in legacy
 *     `question` + `question_description` + `question_audio_video_paragraph`,
 *     then writes a `tq_org_questions` mapping row per imported question so
 *     the question is scoped to the importing org.
 *   - Lists own-bank questions with the same filter shape as the Testquest
 *     bank picker (so 2.4 can compose the two cleanly).
 *   - Looks up a single own-bank question with options for preview.
 *
 * Per-row errors don't abort the batch — the import returns a summary so the
 * owner can fix the bad rows and re-upload only those.
 *
 * Plan-tier gating (Starter blocks imports) is NOT enforced here yet —
 * leave a TODO PLAN_GATE for when live billing wiring lands.
 */
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import {
  createQuestion,
  type AdminQuestionType,
  type AdminDifficulty,
} from "@/lib/legacy-admin";

// ─── Types ─────────────────────────────────────────────────────────

const VALID_TYPES = new Set<AdminQuestionType>(["SINGLE_MCQ", "MULTI_MCQ", "FILL_IN_BLANK"]);
const VALID_DIFFS = new Set<AdminDifficulty>(["EASY", "MEDIUM", "HARD"]);
const LETTER_TO_OPT: Record<string, "option_a" | "option_b" | "option_c" | "option_d"> = {
  A: "option_a", B: "option_b", C: "option_c", D: "option_d",
};

/** Raw row shape after sheet-to-json (everything optional + stringly-typed). */
interface RawRow {
  subject_id?: unknown;
  type?: unknown;
  difficulty?: unknown;
  question_text?: unknown;
  option_a?: unknown;
  option_b?: unknown;
  option_c?: unknown;
  option_d?: unknown;
  correct_answer?: unknown;
  explanation?: unknown;
  marks?: unknown;
}

export interface RowError {
  /** 1-based row number as it appears in Excel (header is row 1, first data row is 2). */
  row: number;
  message: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: RowError[];
}

// ─── Import ────────────────────────────────────────────────────────

export class QuestionBankError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

interface ImportInput {
  orgId: number;
  createdBy: number;
  buffer: Buffer;
}

export async function importQuestionsFromXlsx(input: ImportInput): Promise<ImportResult> {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(input.buffer, { type: "buffer" });
  } catch {
    throw new QuestionBankError("BAD_FILE", "We couldn't read that file. Make sure it's a .xlsx.", 422);
  }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new QuestionBankError("EMPTY_FILE", "That spreadsheet has no sheets.", 422);
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: "" });
  if (rows.length === 0) {
    throw new QuestionBankError("EMPTY_SHEET", "That sheet is empty. Use the template as a starting point.", 422);
  }
  if (rows.length > 500) {
    throw new QuestionBankError("TOO_MANY", "Imports are capped at 500 rows per file. Split into smaller batches.", 422);
  }

  // Cache subject lookups so a 500-row file doesn't fire 500 queries.
  const subjectCache = new Map<number, boolean>();
  async function subjectIsValid(id: number): Promise<boolean> {
    if (subjectCache.has(id)) return subjectCache.get(id)!;
    const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
      `SELECT id FROM vw_subjects WHERE id = ? AND isActive = 1 LIMIT 1`,
      id,
    );
    const ok = rows.length > 0;
    subjectCache.set(id, ok);
    return ok;
  }

  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const excelRow = i + 2; // header is row 1
    const validated = await validateRow(raw, excelRow, subjectIsValid);
    if ("error" in validated) {
      result.skipped++;
      result.errors.push({ row: excelRow, message: validated.error });
      continue;
    }
    try {
      const questionId = await createQuestion({
        subjectId:   validated.subjectId,
        type:        validated.type,
        difficulty:  validated.difficulty,
        text:        validated.text,
        marks:       validated.marks,
        explanation: validated.explanation,
        options:     validated.options ?? undefined,
        correctText: validated.correctText ?? undefined,
      });
      await prisma.orgQuestion.create({
        data: {
          orgId: input.orgId,
          legacyQuestionId: questionId,
          createdBy: input.createdBy,
        },
      });
      result.imported++;
    } catch (err) {
      result.skipped++;
      result.errors.push({
        row: excelRow,
        message: err instanceof Error ? `Couldn't save: ${err.message}` : "Couldn't save this row.",
      });
    }
  }

  return result;
}

// ─── Per-row validation ───────────────────────────────────────────

interface ValidRow {
  subjectId: number;
  type: AdminQuestionType;
  difficulty: AdminDifficulty;
  text: string;
  marks: number;
  explanation: string | null;
  options: Array<{ label: string; text: string; isCorrect: boolean }> | null;
  correctText: string | null;
}

async function validateRow(
  raw: RawRow,
  excelRow: number,
  subjectIsValid: (id: number) => Promise<boolean>,
): Promise<ValidRow | { error: string }> {
  void excelRow;
  const subjectId = Number(raw.subject_id);
  if (!Number.isFinite(subjectId) || subjectId <= 0) {
    return { error: "subject_id must be a positive number." };
  }
  if (!(await subjectIsValid(subjectId))) {
    return { error: `subject_id ${subjectId} doesn't exist or isn't active.` };
  }
  const type = String(raw.type ?? "").trim().toUpperCase();
  if (!VALID_TYPES.has(type as AdminQuestionType)) {
    return { error: `type must be one of SINGLE_MCQ, MULTI_MCQ, FILL_IN_BLANK (got "${type}").` };
  }
  const difficulty = String(raw.difficulty ?? "").trim().toUpperCase();
  if (!VALID_DIFFS.has(difficulty as AdminDifficulty)) {
    return { error: `difficulty must be one of EASY, MEDIUM, HARD (got "${difficulty}").` };
  }
  const text = String(raw.question_text ?? "").trim();
  if (text.length < 5) {
    return { error: "question_text is too short (min 5 characters)." };
  }
  const marksNum = raw.marks === "" || raw.marks == null ? 1 : Number(raw.marks);
  if (!Number.isFinite(marksNum) || marksNum < 1) {
    return { error: "marks must be 1 or more." };
  }
  const explanation = String(raw.explanation ?? "").trim() || null;
  const correctRaw = String(raw.correct_answer ?? "").trim();
  if (correctRaw.length === 0) {
    return { error: "correct_answer is required." };
  }

  if (type === "FILL_IN_BLANK") {
    return {
      subjectId,
      type: "FILL_IN_BLANK",
      difficulty: difficulty as AdminDifficulty,
      text,
      marks: marksNum,
      explanation,
      options: null,
      correctText: correctRaw,
    };
  }

  // MCQ paths — gather options A-D.
  const optTexts: Record<string, string> = {
    A: String(raw.option_a ?? "").trim(),
    B: String(raw.option_b ?? "").trim(),
    C: String(raw.option_c ?? "").trim(),
    D: String(raw.option_d ?? "").trim(),
  };
  const filled = Object.entries(optTexts).filter(([, v]) => v.length > 0);
  if (filled.length < 2) {
    return { error: "MCQ questions need at least 2 options filled in." };
  }
  const correctLetters = correctRaw
    .toUpperCase()
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const letter of correctLetters) {
    if (!LETTER_TO_OPT[letter]) {
      return { error: `correct_answer references "${letter}" which is not A-D.` };
    }
    if (!optTexts[letter] || optTexts[letter].length === 0) {
      return { error: `correct_answer "${letter}" points to an empty option column.` };
    }
  }
  if (type === "MULTI_MCQ" && correctLetters.length < 2) {
    return { error: "MULTI_MCQ needs at least 2 correct answers (e.g. \"A,C\")." };
  }
  if (type === "SINGLE_MCQ" && correctLetters.length !== 1) {
    return { error: "SINGLE_MCQ needs exactly one correct answer." };
  }

  const correctSet = new Set(correctLetters);
  const options = filled.map(([label, txt]) => ({
    label,
    text: txt,
    isCorrect: correctSet.has(label),
  }));
  return {
    subjectId,
    type: type as AdminQuestionType,
    difficulty: difficulty as AdminDifficulty,
    text,
    marks: marksNum,
    explanation,
    options,
    correctText: null,
  };
}

// ─── List + detail ─────────────────────────────────────────────────

export interface OrgQuestionRow {
  id: number;
  subjectId: number | null;
  subjectName: string | null;
  text: string;
  type: AdminQuestionType | "PARAGRAPH";
  difficulty: AdminDifficulty;
  optionCount: number;
  createdAt: Date;
}

export interface ListOrgQuestionsInput {
  orgId: number;
  classId?: number;
  subjectIds?: number[];
  difficulty?: AdminDifficulty | "ALL";
  type?: AdminQuestionType | "ALL";
  query?: string;
  limit?: number;
  offset?: number;
}

export interface ListOrgQuestionsResult {
  rows: OrgQuestionRow[];
  total: number;
  limit: number;
  offset: number;
}

export async function listOrgQuestions(input: ListOrgQuestionsInput): Promise<ListOrgQuestionsResult> {
  const limit = Math.min(60, Math.max(1, input.limit ?? 25));
  const offset = Math.max(0, input.offset ?? 0);

  const where: string[] = [
    "oq.orgId = ?",
    "oq.isActive = TRUE",
    "q.isActive = 1",
  ];
  const args: (string | number)[] = [input.orgId];

  if (input.classId) {
    where.push("s.classId = ?");
    args.push(input.classId);
  }
  if (input.subjectIds && input.subjectIds.length > 0) {
    where.push(`q.subjectId IN (${input.subjectIds.map(() => "?").join(",")})`);
    args.push(...input.subjectIds);
  }
  if (input.difficulty && input.difficulty !== "ALL") {
    where.push("q.difficulty = ?");
    args.push(input.difficulty);
  }
  if (input.type && input.type !== "ALL") {
    where.push("q.type = ?");
    args.push(input.type);
  }
  if (input.query && input.query.trim().length > 0) {
    where.push("q.text LIKE ?");
    args.push(`%${input.query.trim()}%`);
  }

  const whereSql = where.join(" AND ");

  const rows = await prisma.$queryRawUnsafe<Array<{
    id: number;
    subjectId: number | null;
    subjectName: string | null;
    text: string | null;
    type: string;
    difficulty: string;
    optionCount: bigint;
    createdAt: Date;
  }>>(
    `SELECT q.id, q.subjectId, s.name AS subjectName,
            q.text, q.type, q.difficulty,
            (SELECT COUNT(*) FROM vw_question_options o WHERE o.questionId = q.id) AS optionCount,
            oq.createdAt
     FROM tq_org_questions oq
     INNER JOIN vw_questions q ON q.id = oq.legacyQuestionId
     LEFT JOIN vw_subjects s ON s.id = q.subjectId
     WHERE ${whereSql}
     ORDER BY oq.createdAt DESC
     LIMIT ? OFFSET ?`,
    ...args, limit, offset,
  );

  const totalRow = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
    `SELECT COUNT(*) AS cnt
     FROM tq_org_questions oq
     INNER JOIN vw_questions q ON q.id = oq.legacyQuestionId
     LEFT JOIN vw_subjects s ON s.id = q.subjectId
     WHERE ${whereSql}`,
    ...args,
  );

  return {
    rows: rows.map((r) => ({
      id: Number(r.id),
      subjectId: r.subjectId !== null ? Number(r.subjectId) : null,
      subjectName: r.subjectName,
      text: stripHtml(r.text ?? "") || `Question ${Number(r.id)}`,
      type: r.type as OrgQuestionRow["type"],
      difficulty: r.difficulty as AdminDifficulty,
      optionCount: Number(r.optionCount),
      createdAt: r.createdAt,
    })),
    total: Number(totalRow[0]?.cnt ?? 0),
    limit,
    offset,
  };
}

/** Confirm a question id belongs to this org's bank. Used by the detail
 *  endpoint to gate access. Returns the legacy question id if owned, else null. */
export async function orgOwnsQuestion(orgId: number, questionId: number): Promise<boolean> {
  const r = await prisma.orgQuestion.findFirst({
    where: { orgId, legacyQuestionId: questionId, isActive: true },
    select: { id: true },
  });
  return r != null;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
}
