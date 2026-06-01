/**
 * Admin writes go to the legacy tables (`catigories`, `subjects`,
 * `subjects_description`, `subcategories`, `question`, `question_description`,
 * `question_audio_video_paragraph`, `main_exam`, `main_exam_description`,
 * `main_exam_to_question`).
 *
 * Deletes are soft — we flip the *_status column to 0.
 *
 * All description rows are written with languages_id = 3 (English).
 */
import { prisma } from "./db";

const LANG_EN = 3;

// ─── Type mapping helpers (new enum ↔ legacy codes) ───────────────

export type AdminQuestionType = "SINGLE_MCQ" | "MULTI_MCQ" | "FILL_IN_BLANK";
export type AdminDifficulty = "EASY" | "MEDIUM" | "HARD";

interface LegacyTypeCodes { answerType: number; questionType: number }

export function toLegacyTypeCodes(t: AdminQuestionType): LegacyTypeCodes {
  switch (t) {
    case "MULTI_MCQ":     return { answerType: 102, questionType: 504 };
    case "FILL_IN_BLANK": return { answerType: 101, questionType: 507 };
    case "SINGLE_MCQ":
    default:              return { answerType: 101, questionType: 505 };
  }
}

export function toLegacyDifficulty(d: AdminDifficulty): number {
  return d === "EASY" ? 1 : d === "HARD" ? 3 : 2;
}

/**
 * Compose the legacy "1,2,,,," position list given the 1-based positions that
 * are correct. Pads to six slots.
 */
export function positionsToLegacyCsv(positions: number[]): string {
  const set = new Set(positions);
  const out: string[] = [];
  for (let i = 1; i <= 6; i++) out.push(set.has(i) ? String(i) : "");
  return out.join(",");
}

// ─── Classes (catigories) ─────────────────────────────────────────

export interface CreateClassInput { name: string; isActive?: boolean }

export async function createClass(input: CreateClassInput): Promise<number> {
  const isActive = input.isActive === false ? 0 : 1;
  await prisma.$executeRawUnsafe(
    `INSERT INTO catigories (categories_status) VALUES (?)`,
    isActive
  );
  const last = await prisma.$queryRaw<Array<{ id: number }>>`SELECT LAST_INSERT_ID() as id`;
  const newId = Number(last[0].id);
  await prisma.$executeRawUnsafe(
    `INSERT INTO catigories_description (categories_id, languages_id, categories_name) VALUES (?, ?, ?)`,
    newId, LANG_EN, input.name
  );
  return newId;
}

export interface UpdateClassInput { name?: string; isActive?: boolean }

export async function updateClass(id: number, patch: UpdateClassInput): Promise<void> {
  if (patch.isActive !== undefined) {
    await prisma.$executeRawUnsafe(
      `UPDATE catigories SET categories_status = ? WHERE categories_id = ?`,
      patch.isActive ? 1 : 0, id
    );
  }
  if (patch.name !== undefined) {
    // Upsert the English description row
    const existing = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
      `SELECT COUNT(*) as cnt FROM catigories_description WHERE categories_id = ? AND languages_id = ?`,
      id, LANG_EN
    );
    if (Number(existing[0].cnt) > 0) {
      await prisma.$executeRawUnsafe(
        `UPDATE catigories_description SET categories_name = ? WHERE categories_id = ? AND languages_id = ?`,
        patch.name, id, LANG_EN
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO catigories_description (categories_id, languages_id, categories_name) VALUES (?, ?, ?)`,
        id, LANG_EN, patch.name
      );
    }
  }
}

export async function softDeleteClass(id: number): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE catigories SET categories_status = 0 WHERE categories_id = ?`,
    id
  );
}

// ─── Subjects ─────────────────────────────────────────────────────

export interface CreateSubjectInput { name: string; classId: number; isActive?: boolean }

export async function createSubject(input: CreateSubjectInput): Promise<number> {
  const isActive = input.isActive === false ? 0 : 1;
  await prisma.$executeRawUnsafe(
    `INSERT INTO subjects (subjects_status, Temp_Subject_Name) VALUES (?, ?)`,
    isActive, input.name
  );
  const last = await prisma.$queryRaw<Array<{ id: number }>>`SELECT LAST_INSERT_ID() as id`;
  const newId = Number(last[0].id);

  await prisma.$executeRawUnsafe(
    `INSERT INTO subjects_description (subjects_id, languages_id, subject_name, subject_description) VALUES (?, ?, ?, '')`,
    newId, LANG_EN, input.name
  );

  // Link to class via subcategories
  await prisma.$executeRawUnsafe(
    `INSERT INTO subcategories (subcategories_status, subjects_id, categories_id, page_name) VALUES (?, ?, ?, ?)`,
    isActive, newId, input.classId, input.name.toLowerCase().replace(/\s+/g, "-")
  );

  return newId;
}

export interface UpdateSubjectInput {
  name?: string;
  classId?: number;
  isActive?: boolean;
}

export async function updateSubject(id: number, patch: UpdateSubjectInput): Promise<void> {
  if (patch.isActive !== undefined || patch.name !== undefined) {
    const sets: string[] = [];
    const args: (string | number)[] = [];
    if (patch.isActive !== undefined) { sets.push("subjects_status = ?"); args.push(patch.isActive ? 1 : 0); }
    if (patch.name !== undefined) { sets.push("Temp_Subject_Name = ?"); args.push(patch.name); }
    args.push(id);
    await prisma.$executeRawUnsafe(`UPDATE subjects SET ${sets.join(", ")} WHERE subjects_id = ?`, ...args);
  }

  if (patch.name !== undefined) {
    const existing = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
      `SELECT COUNT(*) as cnt FROM subjects_description WHERE subjects_id = ? AND languages_id = ?`,
      id, LANG_EN
    );
    if (Number(existing[0].cnt) > 0) {
      await prisma.$executeRawUnsafe(
        `UPDATE subjects_description SET subject_name = ? WHERE subjects_id = ? AND languages_id = ?`,
        patch.name, id, LANG_EN
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO subjects_description (subjects_id, languages_id, subject_name, subject_description) VALUES (?, ?, ?, '')`,
        id, LANG_EN, patch.name
      );
    }
  }

  if (patch.classId !== undefined) {
    // Update or insert the subcategories row that links subject → class
    const existing = await prisma.$queryRawUnsafe<Array<{ subcategories_id: number }>>(
      `SELECT subcategories_id FROM subcategories WHERE subjects_id = ? LIMIT 1`,
      id
    );
    if (existing[0]) {
      await prisma.$executeRawUnsafe(
        `UPDATE subcategories SET categories_id = ? WHERE subcategories_id = ?`,
        patch.classId, existing[0].subcategories_id
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO subcategories (subcategories_status, subjects_id, categories_id, page_name) VALUES (1, ?, ?, '')`,
        id, patch.classId
      );
    }
  }
}

export async function softDeleteSubject(id: number): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE subjects SET subjects_status = 0 WHERE subjects_id = ?`,
    id
  );
}

// ─── Questions ────────────────────────────────────────────────────

export interface QuestionOptionInput {
  label: string;     // A, B, C, D, E, F
  text: string;
  isCorrect: boolean;
}

export interface CreateQuestionInput {
  subjectId: number;
  type: AdminQuestionType;
  difficulty: AdminDifficulty;
  text: string;
  marks: number;
  explanation?: string | null;
  // For MCQ
  options?: QuestionOptionInput[];
  // For FILL_IN_BLANK — accepted answer text
  correctText?: string | null;
}

const LABEL_TO_POS: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6 };

export async function createQuestion(input: CreateQuestionInput): Promise<number> {
  const codes = toLegacyTypeCodes(input.type);
  const difficulty = toLegacyDifficulty(input.difficulty);
  const totalOptions = input.options?.length ?? 0;

  // 1) question master
  await prisma.$executeRawUnsafe(
    `INSERT INTO question (
       subjects_id, difficulty_level, total_questions,
       answer_type, question_type, total_options,
       question_status, center_id, create_by, approval
     ) VALUES (?, ?, 1, ?, ?, ?, 1, 0, 0, 1)`,
    input.subjectId, difficulty, codes.answerType, codes.questionType, totalOptions
  );
  const last = await prisma.$queryRaw<Array<{ id: number }>>`SELECT LAST_INSERT_ID() as id`;
  const newId = Number(last[0].id);

  // 2) question_description (English text)
  await prisma.$executeRawUnsafe(
    `INSERT INTO question_description (question_id, subjects_id, languages_id, main_question) VALUES (?, ?, ?, ?)`,
    newId, input.subjectId, LANG_EN, input.text
  );

  // 3) options + correct + Marks (in question_audio_video_paragraph)
  let opt1 = "", opt2 = "", opt3 = "", opt4 = "", opt5 = "", opt6 = "";
  let correctAnswer = "";

  if (input.type === "FILL_IN_BLANK") {
    // Store the accepted answer in options_1 (per legacy convention for fill)
    opt1 = input.correctText ?? "";
    correctAnswer = "1,,,,,";
  } else if (input.options && input.options.length > 0) {
    const byLabel: Record<string, QuestionOptionInput> = {};
    for (const o of input.options) byLabel[o.label.toUpperCase()] = o;
    const slots = (["A", "B", "C", "D", "E", "F"] as const).map(letter => byLabel[letter] ?? null);
    [opt1, opt2, opt3, opt4, opt5, opt6] = slots.map(s => s?.text ?? "");
    const correctPositions = input.options
      .filter(o => o.isCorrect)
      .map(o => LABEL_TO_POS[o.label.toUpperCase()])
      .filter(Boolean);
    correctAnswer = positionsToLegacyCsv(correctPositions);
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO question_audio_video_paragraph (
       question_id, subjects_id, languages_id, sub_question_id,
       sub_question, hint, explanation,
       options_1, options_2, options_3, options_4, options_5, options_6,
       Marks, correct_answer
     ) VALUES (?, ?, ?, 0, '', '', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newId, input.subjectId, LANG_EN,
    input.explanation ?? "",
    opt1, opt2, opt3, opt4, opt5, opt6,
    Math.max(1, input.marks), correctAnswer
  );

  return newId;
}

export interface UpdateQuestionInput {
  subjectId?: number;
  type?: AdminQuestionType;
  difficulty?: AdminDifficulty;
  text?: string;
  marks?: number;
  explanation?: string | null;
  options?: QuestionOptionInput[];
  correctText?: string | null;
}

export async function updateQuestion(id: number, patch: UpdateQuestionInput): Promise<void> {
  // 1) question master fields
  const sets: string[] = [];
  const args: (string | number)[] = [];
  if (patch.subjectId !== undefined) { sets.push("subjects_id = ?"); args.push(patch.subjectId); }
  if (patch.difficulty !== undefined) { sets.push("difficulty_level = ?"); args.push(toLegacyDifficulty(patch.difficulty)); }
  if (patch.type !== undefined) {
    const codes = toLegacyTypeCodes(patch.type);
    sets.push("answer_type = ?"); args.push(codes.answerType);
    sets.push("question_type = ?"); args.push(codes.questionType);
  }
  if (patch.options !== undefined) {
    sets.push("total_options = ?"); args.push(patch.options.length);
  }
  if (sets.length > 0) {
    args.push(id);
    await prisma.$executeRawUnsafe(`UPDATE question SET ${sets.join(", ")} WHERE question_id = ?`, ...args);
  }

  // 2) text
  if (patch.text !== undefined) {
    const existing = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
      `SELECT COUNT(*) as cnt FROM question_description WHERE question_id = ? AND languages_id = ?`,
      id, LANG_EN
    );
    const subjId = patch.subjectId ?? (await prisma.$queryRawUnsafe<Array<{ subjects_id: number }>>(
      `SELECT subjects_id FROM question WHERE question_id = ?`, id
    ))[0]?.subjects_id ?? 0;
    if (Number(existing[0].cnt) > 0) {
      await prisma.$executeRawUnsafe(
        `UPDATE question_description SET main_question = ?, subjects_id = ? WHERE question_id = ? AND languages_id = ?`,
        patch.text, subjId, id, LANG_EN
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO question_description (question_id, subjects_id, languages_id, main_question) VALUES (?, ?, ?, ?)`,
        id, subjId, LANG_EN, patch.text
      );
    }
  }

  // 3) options + correct + marks + explanation in qavp
  if (
    patch.options !== undefined ||
    patch.correctText !== undefined ||
    patch.marks !== undefined ||
    patch.explanation !== undefined ||
    patch.type !== undefined
  ) {
    // Current row reference
    const existing = await prisma.$queryRawUnsafe<Array<{ id: number; subjects_id: number; Marks: number | null; explanation: string | null }>>(
      `SELECT id, subjects_id, Marks, explanation FROM question_audio_video_paragraph
       WHERE question_id = ? AND languages_id = ? AND sub_question_id = 0 LIMIT 1`,
      id, LANG_EN
    );
    const subjId = patch.subjectId ?? existing[0]?.subjects_id ?? 0;

    let opt1 = "", opt2 = "", opt3 = "", opt4 = "", opt5 = "", opt6 = "";
    let correctAnswer = "";

    if (patch.type === "FILL_IN_BLANK" || (patch.correctText !== undefined && patch.options === undefined)) {
      opt1 = patch.correctText ?? "";
      correctAnswer = "1,,,,,";
    } else if (patch.options) {
      const byLabel: Record<string, QuestionOptionInput> = {};
      for (const o of patch.options) byLabel[o.label.toUpperCase()] = o;
      const slots = (["A", "B", "C", "D", "E", "F"] as const).map(letter => byLabel[letter] ?? null);
      [opt1, opt2, opt3, opt4, opt5, opt6] = slots.map(s => s?.text ?? "");
      const correctPositions = patch.options
        .filter(o => o.isCorrect)
        .map(o => LABEL_TO_POS[o.label.toUpperCase()])
        .filter(Boolean);
      correctAnswer = positionsToLegacyCsv(correctPositions);
    }

    const marks = patch.marks ?? existing[0]?.Marks ?? 1;
    const explanation = patch.explanation ?? existing[0]?.explanation ?? "";

    if (existing[0]) {
      // UPDATE only fields the caller intends to change
      const setsQ: string[] = [];
      const argsQ: (string | number)[] = [];
      if (patch.options !== undefined || patch.correctText !== undefined || patch.type !== undefined) {
        setsQ.push("options_1 = ?", "options_2 = ?", "options_3 = ?", "options_4 = ?", "options_5 = ?", "options_6 = ?", "correct_answer = ?");
        argsQ.push(opt1, opt2, opt3, opt4, opt5, opt6, correctAnswer);
      }
      if (patch.marks !== undefined) { setsQ.push("Marks = ?"); argsQ.push(marks); }
      if (patch.explanation !== undefined) { setsQ.push("explanation = ?"); argsQ.push(explanation ?? ""); }
      if (patch.subjectId !== undefined) { setsQ.push("subjects_id = ?"); argsQ.push(subjId); }
      if (setsQ.length > 0) {
        argsQ.push(existing[0].id);
        await prisma.$executeRawUnsafe(
          `UPDATE question_audio_video_paragraph SET ${setsQ.join(", ")} WHERE id = ?`,
          ...argsQ
        );
      }
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO question_audio_video_paragraph (
           question_id, subjects_id, languages_id, sub_question_id,
           sub_question, hint, explanation,
           options_1, options_2, options_3, options_4, options_5, options_6,
           Marks, correct_answer
         ) VALUES (?, ?, ?, 0, '', '', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id, subjId, LANG_EN, explanation ?? "",
        opt1, opt2, opt3, opt4, opt5, opt6,
        marks, correctAnswer
      );
    }
  }
}

export async function softDeleteQuestion(id: number): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE question SET question_status = 0 WHERE question_id = ?`,
    id
  );
}

// ─── Tests (main_exam) ────────────────────────────────────────────

export interface CreateTestInput {
  name: string;
  description?: string | null;
  classId: number;
  subjectId: number;
  durationMinutes: number;
  isFree?: boolean;
  price?: number;
  retakeCooldownDays?: number;
  passingPercentage?: number;
  isActive?: boolean;
  questionIds: number[];
}

export async function createTest(input: CreateTestInput): Promise<number> {
  const isActive = input.isActive === false ? 0 : 1;
  const price = input.price ?? 0;
  const subcategoriesId = await pickSubcategoryForSubject(input.subjectId, input.classId);

  // 1) main_exam
  await prisma.$executeRawUnsafe(
    `INSERT INTO main_exam (
       category_id, subcategories_id, subject_choose, subject_id,
       exam_date, exam_duration, passing_percentage, re_exam_day,
       neg_mark_status, negative_marks, result_show_on_mail, after_exam_show_result,
       exam_status, sale_exam_without_packages_status, exam_price
     ) VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, 0, 0, 0, 1, ?, ?, ?)`,
    input.classId, subcategoriesId, String(input.subjectId), String(input.subjectId),
    input.durationMinutes, String(input.passingPercentage ?? 0), input.retakeCooldownDays ?? 0,
    isActive, price > 0 ? 1 : 0, price
  );
  const last = await prisma.$queryRaw<Array<{ id: number }>>`SELECT LAST_INSERT_ID() as id`;
  const newId = Number(last[0].id);

  // 2) description
  await prisma.$executeRawUnsafe(
    `INSERT INTO main_exam_description (exam_id, languages_id, exam_name, terms_condition) VALUES (?, ?, ?, ?)`,
    newId, LANG_EN, input.name, input.description ?? ""
  );

  // 3) link questions
  if (input.questionIds.length > 0) {
    await setTestQuestions(newId, input.questionIds);
  }

  return newId;
}

export interface UpdateTestInput {
  name?: string;
  description?: string | null;
  classId?: number;
  subjectId?: number;
  durationMinutes?: number;
  isFree?: boolean;
  price?: number;
  retakeCooldownDays?: number;
  passingPercentage?: number;
  isActive?: boolean;
}

export async function updateTest(id: number, patch: UpdateTestInput): Promise<void> {
  const sets: string[] = [];
  const args: (string | number)[] = [];
  if (patch.classId !== undefined) { sets.push("category_id = ?"); args.push(patch.classId); }
  if (patch.subjectId !== undefined) {
    sets.push("subject_choose = ?"); args.push(String(patch.subjectId));
    sets.push("subject_id = ?"); args.push(String(patch.subjectId));
  }
  if (patch.durationMinutes !== undefined) { sets.push("exam_duration = ?"); args.push(patch.durationMinutes); }
  if (patch.price !== undefined) {
    sets.push("exam_price = ?"); args.push(patch.price);
    sets.push("sale_exam_without_packages_status = ?"); args.push(patch.price > 0 ? 1 : 0);
  }
  if (patch.retakeCooldownDays !== undefined) { sets.push("re_exam_day = ?"); args.push(patch.retakeCooldownDays); }
  if (patch.passingPercentage !== undefined) { sets.push("passing_percentage = ?"); args.push(String(patch.passingPercentage)); }
  if (patch.isActive !== undefined) { sets.push("exam_status = ?"); args.push(patch.isActive ? 1 : 0); }

  if (sets.length > 0) {
    args.push(id);
    await prisma.$executeRawUnsafe(`UPDATE main_exam SET ${sets.join(", ")} WHERE exam_id = ?`, ...args);
  }

  if (patch.name !== undefined || patch.description !== undefined) {
    const existing = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
      `SELECT COUNT(*) as cnt FROM main_exam_description WHERE exam_id = ? AND languages_id = ?`,
      id, LANG_EN
    );
    if (Number(existing[0].cnt) > 0) {
      const setsD: string[] = [];
      const argsD: (string | number)[] = [];
      if (patch.name !== undefined) { setsD.push("exam_name = ?"); argsD.push(patch.name); }
      if (patch.description !== undefined) { setsD.push("terms_condition = ?"); argsD.push(patch.description ?? ""); }
      argsD.push(id);
      await prisma.$executeRawUnsafe(
        `UPDATE main_exam_description SET ${setsD.join(", ")} WHERE exam_id = ? AND languages_id = ${LANG_EN}`,
        ...argsD
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO main_exam_description (exam_id, languages_id, exam_name, terms_condition) VALUES (?, ?, ?, ?)`,
        id, LANG_EN, patch.name ?? "", patch.description ?? ""
      );
    }
  }
}

export async function softDeleteTest(id: number): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE main_exam SET exam_status = 0 WHERE exam_id = ?`,
    id
  );
}

/**
 * Replace the question list for a test. Pulls per-question metadata
 * (correct_answer, Marks, answer_type, difficulty, question_type) from the
 * question + qavp tables so main_exam_to_question stays consistent.
 */
export async function setTestQuestions(testId: number, questionIds: number[]): Promise<void> {
  // Remove existing links
  await prisma.$executeRawUnsafe(
    `DELETE FROM main_exam_to_question WHERE exam_id = ?`,
    testId
  );
  if (questionIds.length === 0) return;

  // Fetch metadata for each question (in one round-trip)
  const placeholders = questionIds.map(() => "?").join(",");
  const meta = await prisma.$queryRawUnsafe<Array<{
    question_id: number; subjects_id: number; answer_type: number; question_type: number;
    difficulty_level: number; total_options: number;
    correct_answer: string | null; Marks: number | null;
  }>>(
    `SELECT q.question_id, q.subjects_id, q.answer_type, q.question_type, q.difficulty_level, q.total_options,
            qavp.correct_answer, qavp.Marks
     FROM question q
     LEFT JOIN question_audio_video_paragraph qavp
       ON qavp.question_id = q.question_id AND qavp.languages_id = ${LANG_EN} AND qavp.sub_question_id = 0
     WHERE q.question_id IN (${placeholders})`,
    ...questionIds
  );
  const byId = new Map(meta.map(m => [m.question_id, m]));

  // Insert rows preserving the order provided by the admin
  for (const qid of questionIds) {
    const m = byId.get(qid);
    if (!m) continue;
    await prisma.$executeRawUnsafe(
      `INSERT INTO main_exam_to_question (
         exam_id, question_id, subjects_id, sub_question_id, total_options,
         correct_answer, Marks, answer_type, difficulty_leve, question_type
       ) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
      testId, qid, m.subjects_id, m.total_options,
      m.correct_answer ?? "", m.Marks ?? 1,
      m.answer_type, m.difficulty_level, m.question_type
    );
  }
}

// ─── Internal: pick a subcategories_id to link an exam to its subject ────

async function pickSubcategoryForSubject(subjectId: number, classId: number): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ subcategories_id: number }>>(
    `SELECT subcategories_id FROM subcategories WHERE subjects_id = ? AND categories_id = ? LIMIT 1`,
    subjectId, classId
  );
  if (rows[0]) return rows[0].subcategories_id;
  // Fall back to any subcategory for this subject regardless of class
  const any = await prisma.$queryRawUnsafe<Array<{ subcategories_id: number }>>(
    `SELECT subcategories_id FROM subcategories WHERE subjects_id = ? LIMIT 1`,
    subjectId
  );
  if (any[0]) return any[0].subcategories_id;
  // Last resort: insert a new linkage row
  await prisma.$executeRawUnsafe(
    `INSERT INTO subcategories (subcategories_status, subjects_id, categories_id, page_name) VALUES (1, ?, ?, '')`,
    subjectId, classId
  );
  const last = await prisma.$queryRaw<Array<{ id: number }>>`SELECT LAST_INSERT_ID() as id`;
  return Number(last[0].id);
}
