import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_ROWS = 2000;

/**
 * Bulk question import for one offering, from .xlsx / .csv.
 *
 * Columns (header row required, case-insensitive, order-independent):
 *   chapter          chapter NAME in this offering — blank leaves it untagged
 *   type             SINGLE_MCQ | MULTI_MCQ | FILL_IN_BLANK
 *   difficulty       EASY | MEDIUM | HARD          (default MEDIUM)
 *   question_text    the question, plain text or HTML
 *   option_a … option_f
 *   correct_answer   "B" or "A,C" for MCQ; the accepted answer for fill-in
 *   explanation      optional
 *   marks            optional, default 1
 *
 * Chapters are matched by name rather than id so a content author never has to
 * look up database ids. Per-row errors are collected and reported instead of
 * aborting the batch — a typo in row 40 must not discard rows 1–39.
 */
type RawRow = Record<string, unknown>;

const OPTION_KEYS = ["option_a", "option_b", "option_c", "option_d", "option_e", "option_f"];
const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];

function cell(row: RawRow, key: string): string {
  const v = row[key];
  if (v == null) return "";
  return String(v).trim();
}

/** Header cells vary wildly in the wild; normalise to snake_case. */
function normaliseKeys(row: RawRow): RawRow {
  const out: RawRow = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.trim().toLowerCase().replace(/[\s-]+/g, "_")] = v;
  }
  return out;
}

export async function POST(request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const offeringId = Number(id);

    const offering = await prisma.offering.findUnique({
      where: { id: offeringId },
      select: { id: true, subjectId: true },
    });
    if (!offering) return error("Offering not found", 404);

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return error("That upload looks corrupted. Try again.", 400);
    }
    const file = form.get("file");
    if (!file || !(file instanceof File)) return error("Pick a .xlsx or .csv file to upload.", 400);
    if (file.size === 0) return error("That file is empty.", 400);
    if (file.size > MAX_BYTES) return error("File is too large — keep imports under 5 MB.", 413);

    const buffer = Buffer.from(await file.arrayBuffer());
    let rows: RawRow[];
    try {
      const wb = XLSX.read(buffer, { type: "buffer" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) return error("That workbook has no sheets.", 400);
      rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: "" }).map(normaliseKeys);
    } catch {
      return error("Could not read that file. Save it as .xlsx or .csv and retry.", 400);
    }

    if (rows.length === 0) return error("No rows found under the header.", 400);
    if (rows.length > MAX_ROWS) return error(`Too many rows (${rows.length}). Split into files of ${MAX_ROWS} or fewer.`, 413);

    const chapters = await prisma.chapter.findMany({
      where: { offeringId, isActive: true },
      select: { id: true, name: true },
    });
    const chapterByName = new Map(chapters.map((c) => [c.name.trim().toLowerCase(), c.id]));

    const errors: Array<{ row: number; message: string }> = [];
    const toCreate: Array<{
      chapterId: number | null; type: "SINGLE_MCQ" | "MULTI_MCQ" | "FILL_IN_BLANK";
      difficulty: "EASY" | "MEDIUM" | "HARD"; text: string; explanation: string | null;
      correctText: string | null; marks: number;
      options: Array<{ label: string; text: string; isCorrect: boolean; sortOrder: number }>;
    }> = [];

    rows.forEach((row, i) => {
      const rowNo = i + 2; // +1 for the header, +1 for 1-based rows
      const fail = (message: string) => errors.push({ row: rowNo, message });

      const text = cell(row, "question_text") || cell(row, "question");
      if (!text) return fail("question_text is empty");

      const rawType = (cell(row, "type") || "SINGLE_MCQ").toUpperCase().replace(/[\s-]+/g, "_");
      if (!["SINGLE_MCQ", "MULTI_MCQ", "FILL_IN_BLANK"].includes(rawType)) {
        return fail(`type "${cell(row, "type")}" is not SINGLE_MCQ, MULTI_MCQ or FILL_IN_BLANK`);
      }
      const type = rawType as "SINGLE_MCQ" | "MULTI_MCQ" | "FILL_IN_BLANK";

      const rawDiff = (cell(row, "difficulty") || "MEDIUM").toUpperCase();
      if (!["EASY", "MEDIUM", "HARD"].includes(rawDiff)) {
        return fail(`difficulty "${cell(row, "difficulty")}" is not EASY, MEDIUM or HARD`);
      }
      const difficulty = rawDiff as "EASY" | "MEDIUM" | "HARD";

      let chapterId: number | null = null;
      const chapterName = cell(row, "chapter") || cell(row, "chapter_name");
      if (chapterName) {
        const found = chapterByName.get(chapterName.toLowerCase());
        if (!found) return fail(`chapter "${chapterName}" does not exist in this offering`);
        chapterId = found;
      }

      const marksRaw = cell(row, "marks");
      const marks = marksRaw ? Number(marksRaw) : 1;
      if (!Number.isFinite(marks) || marks < 1) return fail(`marks "${marksRaw}" is not a positive number`);

      const correctRaw = cell(row, "correct_answer");

      if (type === "FILL_IN_BLANK") {
        if (!correctRaw) return fail("correct_answer (the accepted answer) is required for FILL_IN_BLANK");
        toCreate.push({
          chapterId, type, difficulty, text,
          explanation: cell(row, "explanation") || null,
          correctText: correctRaw, marks, options: [],
        });
        return;
      }

      const options = OPTION_KEYS.map((k, idx) => ({ label: OPTION_LABELS[idx], text: cell(row, k), sortOrder: idx + 1 }))
        .filter((o) => o.text !== "");
      if (options.length < 2) return fail("at least 2 options (option_a, option_b, …) are required");

      const correctLabels = new Set(
        correctRaw.split(/[,\s/|]+/).map((s) => s.trim().toUpperCase()).filter(Boolean),
      );
      if (correctLabels.size === 0) return fail("correct_answer is empty");
      const unknown = [...correctLabels].filter((l) => !options.some((o) => o.label === l));
      if (unknown.length) return fail(`correct_answer refers to option(s) ${unknown.join(", ")} which have no text`);
      if (type === "SINGLE_MCQ" && correctLabels.size !== 1) {
        return fail(`SINGLE_MCQ needs exactly 1 correct answer, got ${correctLabels.size}`);
      }
      if (type === "MULTI_MCQ" && correctLabels.size < 2) {
        return fail("MULTI_MCQ needs at least 2 correct answers");
      }

      toCreate.push({
        chapterId, type, difficulty, text,
        explanation: cell(row, "explanation") || null,
        correctText: null, marks,
        options: options.map((o) => ({ ...o, isCorrect: correctLabels.has(o.label) })),
      });
    });

    // Insert what parsed cleanly. Chunked so one oversized upload doesn't hold
    // a single transaction past the host's statement ceiling.
    let imported = 0;
    const CHUNK = 100;
    for (let i = 0; i < toCreate.length; i += CHUNK) {
      const chunk = toCreate.slice(i, i + CHUNK);
      await prisma.$transaction(
        chunk.map((q) =>
          prisma.question.create({
            data: {
              subjectId: offering.subjectId,
              chapterId: q.chapterId,
              type: q.type,
              difficulty: q.difficulty,
              text: q.text,
              explanation: q.explanation,
              correctText: q.correctText,
              marks: q.marks,
              options: q.options.length ? { create: q.options } : undefined,
            },
            select: { id: true },
          }),
        ),
      );
      imported += chunk.length;
    }

    return success({
      imported,
      skipped: errors.length,
      total: rows.length,
      errors: errors.slice(0, 50),
      truncatedErrors: Math.max(0, errors.length - 50),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
