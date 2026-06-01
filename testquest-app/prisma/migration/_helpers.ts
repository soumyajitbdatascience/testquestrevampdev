/**
 * Shared helpers for the legacy migration scripts.
 */

/** Strip HTML tags from a string and trim whitespace. Preserves text content. */
export function stripHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Map legacy (answer_type, question_type) → new QuestionType enum value. */
export function mapQuestionType(answerType: number, questionType: number): "SINGLE_MCQ" | "MULTI_MCQ" | "FILL_IN_BLANK" | "PARAGRAPH" | "SUBJECTIVE" {
  // FILL_IN_BLANK
  if (answerType === 101 && questionType === 507) return "FILL_IN_BLANK";
  // Common cases
  if (answerType === 101 && questionType === 505) return "SINGLE_MCQ";
  if (answerType === 102 && questionType === 504) return "MULTI_MCQ";
  // Multi MCQ in rare type 502
  if (answerType === 102 && (questionType === 502 || questionType === 501 || questionType === 503)) return "MULTI_MCQ";
  // Single MCQ paragraph variants — flatten to SINGLE_MCQ
  if (answerType === 101 && (questionType === 501 || questionType === 502 || questionType === 503)) return "SINGLE_MCQ";
  // Fallback
  return answerType === 102 ? "MULTI_MCQ" : "SINGLE_MCQ";
}

/** Map legacy difficulty (1/2/3) → new Difficulty enum. */
export function mapDifficulty(d: number | null | undefined): "EASY" | "MEDIUM" | "HARD" {
  if (d === 1) return "EASY";
  if (d === 3) return "HARD";
  return "MEDIUM";
}

/**
 * Parse legacy `correct_answer` position string like "1,2,,,," → indexes [1, 2].
 * Indexes are 1-based positions into options_1…options_6.
 */
export function parseCorrectPositions(s: string | null | undefined): number[] {
  if (!s) return [];
  return s
    .split(",")
    .map(p => p.trim())
    .filter(p => p && !isNaN(Number(p)))
    .map(Number);
}

/**
 * Parse main_exam_to_question.correct_answer which is a single digit or comma list.
 * Returns the same 1-based position indexes.
 */
export const parseExamCorrectAnswer = parseCorrectPositions;

/** Map position (1..6) to letter label. */
export function positionToLabel(pos: number): string {
  return String.fromCharCode(64 + pos); // 1 → 'A'
}

/** Normalize email: lowercase, trim. Returns null if invalid. */
export function normalizeEmail(e: string | null | undefined): string | null {
  if (!e) return null;
  const t = e.trim().toLowerCase();
  if (!t.includes("@") || t.length > 200) return null;
  return t;
}

/** Compose full name from legacy first/second/surname. */
export function composeName(first?: string | null, second?: string | null, surname?: string | null, fallback?: string | null): string {
  const parts = [first, second, surname].map(p => (p || "").trim()).filter(Boolean);
  return parts.join(" ") || fallback?.trim() || "Student";
}

export const LANGUAGE_ID_ENGLISH = 3;
