/**
 * Typed read access to legacy content via vw_* MySQL VIEWs.
 *
 * Why $queryRaw and not Prisma models? The views aren't in our Prisma schema,
 * and we don't want `prisma db push` to ever touch them — that could drop or
 * rewrite the underlying legacy tables. Raw queries skip Prisma's migration
 * machinery entirely.
 *
 * All views filter to English (languages_id = 3). HTML tags in text fields
 * are stripped server-side via stripHtml().
 *
 * Views available:
 *   vw_classes, vw_subjects, vw_questions, vw_question_options,
 *   vw_question_meta, vw_tests, vw_test_questions, vw_students,
 *   vw_attempts_legacy
 */
import { prisma } from "./db";

// ─── Helpers ──────────────────────────────────────────────────────

function stripHtml(s: string | null | undefined): string {
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

// ─── Classes ──────────────────────────────────────────────────────

export interface LegacyClass {
  id: number;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

export async function listClasses(): Promise<LegacyClass[]> {
  const rows = await prisma.$queryRaw<Array<{
    id: number; name: string; isActive: number | boolean; sortOrder: number;
  }>>`
    SELECT id, name, isActive, sortOrder
    FROM vw_classes
    WHERE isActive = 1
    ORDER BY sortOrder
  `;
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    isActive: !!r.isActive,
    sortOrder: r.sortOrder,
  }));
}

// ─── Subjects ─────────────────────────────────────────────────────

export interface LegacySubject {
  id: number;
  name: string;
  classId: number | null;
  isActive: boolean;
}

export async function listSubjects(classId?: number): Promise<LegacySubject[]> {
  const rows = classId
    ? await prisma.$queryRaw<Array<{ id: number; name: string; classId: number | null; isActive: number | boolean }>>`
        SELECT id, name, classId, isActive FROM vw_subjects
        WHERE classId = ${classId} AND isActive = 1
        ORDER BY name
      `
    : await prisma.$queryRaw<Array<{ id: number; name: string; classId: number | null; isActive: number | boolean }>>`
        SELECT id, name, classId, isActive FROM vw_subjects
        WHERE isActive = 1
        ORDER BY name
      `;
  return rows.map(r => ({ id: r.id, name: r.name, classId: r.classId, isActive: !!r.isActive }));
}

// ─── Tests ────────────────────────────────────────────────────────

export interface LegacyTest {
  id: number;
  name: string;
  description: string | null;
  classId: number | null;
  subjectId: number | null;
  durationMinutes: number;
  isFree: boolean;
  price: number;
  isPractice: boolean;
  retakeCooldownDays: number;
  isActive: boolean;
  source: "main" | "practice";
}

export interface LegacyTestWithMeta extends LegacyTest {
  className: string | null;
  subjectName: string | null;
  questionCount: number;
  totalMarks: number;
}

interface TestFilters {
  classId?: number;
  subjectId?: number;
  isFree?: boolean;
  search?: string;
  isPractice?: boolean;
  limit?: number;
  offset?: number;
  /**
   * Phase 2 / Task 2.2 — visibility scope.
   *
   * Without `visibility` set, listTests behaves like before. Callers that want
   * to enforce org scoping pass one of:
   *   - `{ kind: 'b2c' }` — exclude every test that is private to any org
   *     (i.e. has an active row in `tq_org_tests`). Used by the public
   *     /tests browse + the home page.
   *   - `{ kind: 'org', orgId }` — include public Testquest tests AND tests
   *     private to this orgId; exclude tests private to other orgs.
   */
  visibility?: { kind: "b2c" } | { kind: "org"; orgId: number };
}

export async function listTests(filters: TestFilters = {}): Promise<{ tests: LegacyTestWithMeta[]; total: number }> {
  const where: string[] = ["t.isActive = 1"];
  const params: (string | number)[] = [];
  if (filters.classId !== undefined) { where.push("t.classId = ?"); params.push(filters.classId); }
  if (filters.subjectId !== undefined) { where.push("t.subjectId = ?"); params.push(filters.subjectId); }
  if (filters.isFree !== undefined) { where.push("t.isFree = ?"); params.push(filters.isFree ? 1 : 0); }
  if (filters.isPractice !== undefined) { where.push("t.isPractice = ?"); params.push(filters.isPractice ? 1 : 0); }
  if (filters.search) { where.push("t.name LIKE ?"); params.push(`%${filters.search}%`); }
  if (filters.visibility?.kind === "b2c") {
    where.push("NOT EXISTS (SELECT 1 FROM tq_org_tests ot WHERE ot.legacyTestId = t.id AND ot.isActive = TRUE)");
  } else if (filters.visibility?.kind === "org") {
    where.push("NOT EXISTS (SELECT 1 FROM tq_org_tests ot WHERE ot.legacyTestId = t.id AND ot.isActive = TRUE AND ot.orgId <> ?)");
    params.push(filters.visibility.orgId);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = filters.limit ?? 20;
  const offset = filters.offset ?? 0;

  const rows = await prisma.$queryRawUnsafe<Array<{
    id: number; name: string; description: string | null; classId: number | null; subjectId: number | null;
    durationMinutes: number; isFree: number | boolean; price: unknown; isPractice: number | boolean;
    retakeCooldownDays: number; isActive: number | boolean; source: string;
    className: string | null; subjectName: string | null;
    questionCount: bigint | number; totalMarks: bigint | number;
  }>>(
    `SELECT
       t.id, t.name, t.description, t.classId, t.subjectId,
       t.durationMinutes, t.isFree, t.price, t.isPractice,
       t.retakeCooldownDays, t.isActive, t.source,
       c.name AS className,
       s.name AS subjectName,
       (SELECT COUNT(*) FROM vw_test_questions tq WHERE tq.testId = t.id) AS questionCount,
       (SELECT COALESCE(SUM(tq.marks), 0) FROM vw_test_questions tq WHERE tq.testId = t.id) AS totalMarks
     FROM vw_tests t
     LEFT JOIN vw_classes c ON c.id = t.classId
     LEFT JOIN vw_subjects s ON s.id = t.subjectId
     ${whereSql}
     ORDER BY t.id DESC
     LIMIT ? OFFSET ?`,
    ...params, limit, offset
  );

  const totalRow = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
    `SELECT COUNT(*) as cnt FROM vw_tests t ${whereSql}`,
    ...params
  );

  const tests: LegacyTestWithMeta[] = rows.map(r => ({
    id: Number(r.id),
    name: stripHtml(r.name) || `Test ${Number(r.id)}`,
    description: stripHtml(r.description) || null,
    classId: r.classId !== null ? Number(r.classId) : null,
    subjectId: r.subjectId !== null ? Number(r.subjectId) : null,
    durationMinutes: Number(r.durationMinutes) || 30,
    isFree: !!r.isFree,
    price: Number(r.price ?? 0),
    isPractice: !!r.isPractice,
    retakeCooldownDays: Number(r.retakeCooldownDays) || 0,
    isActive: !!r.isActive,
    source: r.source as "main" | "practice",
    className: r.className,
    subjectName: r.subjectName,
    questionCount: Number(r.questionCount),
    totalMarks: Number(r.totalMarks),
  }));

  return { tests, total: Number(totalRow[0].cnt) };
}

export async function getTest(id: number): Promise<LegacyTestWithMeta | null> {
  const rows = await prisma.$queryRaw<Array<{
    id: number; name: string; description: string | null; classId: number | null; subjectId: number | null;
    durationMinutes: number; isFree: number | boolean; price: unknown; isPractice: number | boolean;
    retakeCooldownDays: number; isActive: number | boolean; source: string;
    className: string | null; subjectName: string | null;
    questionCount: bigint | number; totalMarks: bigint | number;
  }>>`
    SELECT
      t.id, t.name, t.description, t.classId, t.subjectId,
      t.durationMinutes, t.isFree, t.price, t.isPractice,
      t.retakeCooldownDays, t.isActive, t.source,
      c.name AS className,
      s.name AS subjectName,
      (SELECT COUNT(*) FROM vw_test_questions tq WHERE tq.testId = t.id) AS questionCount,
      (SELECT COALESCE(SUM(tq.marks), 0) FROM vw_test_questions tq WHERE tq.testId = t.id) AS totalMarks
    FROM vw_tests t
    LEFT JOIN vw_classes c ON c.id = t.classId
    LEFT JOIN vw_subjects s ON s.id = t.subjectId
    WHERE t.id = ${id}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: Number(r.id),
    name: stripHtml(r.name) || `Test ${Number(r.id)}`,
    description: stripHtml(r.description) || null,
    classId: r.classId !== null ? Number(r.classId) : null,
    subjectId: r.subjectId !== null ? Number(r.subjectId) : null,
    durationMinutes: Number(r.durationMinutes) || 30,
    isFree: !!r.isFree,
    price: Number(r.price ?? 0),
    isPractice: !!r.isPractice,
    retakeCooldownDays: Number(r.retakeCooldownDays) || 0,
    isActive: !!r.isActive,
    source: r.source as "main" | "practice",
    className: r.className,
    subjectName: r.subjectName,
    questionCount: Number(r.questionCount),
    totalMarks: Number(r.totalMarks),
  };
}

// ─── Questions ────────────────────────────────────────────────────

export type LegacyQuestionType =
  | "SINGLE_MCQ"
  | "MULTI_MCQ"
  | "FILL_IN_BLANK"
  | "PARAGRAPH";

export interface LegacyQuestion {
  id: number;
  text: string;
  type: LegacyQuestionType;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  subjectId: number | null;
  marks: number;
  explanation: string | null;
  options: LegacyOption[];
}

export interface LegacyOption {
  id: number;
  label: string;
  text: string;
  isCorrect: boolean;
}

/**
 * Fetch full questions for a given test (in test-question order).
 * Strips HTML on the way out.
 */
export async function getTestQuestions(testId: number): Promise<LegacyQuestion[]> {
  const rows = await prisma.$queryRaw<Array<{
    id: number; testQuestionId: number; subjectId: number | null;
    text: string; type: string; difficulty: string;
    marks: number | bigint; explanation: string | null;
  }>>`
    SELECT
      q.id, tq.id AS testQuestionId, q.subjectId,
      q.text, q.type, q.difficulty,
      COALESCE(tq.marks, m.marks, 1) AS marks,
      m.explanation
    FROM vw_test_questions tq
    INNER JOIN vw_questions q ON q.id = tq.questionId
    LEFT JOIN vw_question_meta m ON m.questionId = q.id
    WHERE tq.testId = ${testId}
    ORDER BY tq.sortOrder
  `;
  if (rows.length === 0) return [];

  const qIds = rows.map(r => r.id);
  const placeholders = qIds.map(() => "?").join(",");
  const opts = await prisma.$queryRawUnsafe<Array<{
    id: number; questionId: number; label: string; text: string; isCorrect: number | boolean;
  }>>(
    `SELECT id, questionId, label, text, isCorrect
     FROM vw_question_options
     WHERE questionId IN (${placeholders})
     ORDER BY questionId, sortOrder`,
    ...qIds
  );
  const optsByQ = new Map<number, LegacyOption[]>();
  for (const o of opts) {
    const qid = Number(o.questionId);
    const list = optsByQ.get(qid) || [];
    list.push({ id: Number(o.id), label: o.label, text: stripHtml(o.text), isCorrect: !!o.isCorrect });
    optsByQ.set(qid, list);
  }

  return rows.map(r => ({
    id: Number(r.id),
    text: stripHtml(r.text),
    type: r.type as LegacyQuestionType,
    difficulty: r.difficulty as "EASY" | "MEDIUM" | "HARD",
    subjectId: r.subjectId !== null ? Number(r.subjectId) : null,
    marks: Number(r.marks),
    explanation: stripHtml(r.explanation) || null,
    options: optsByQ.get(Number(r.id)) ?? [],
  }));
}

// ─── Taxonomy tree (for browse filters) ───────────────────────────

export interface TaxonomyClass {
  id: number;
  name: string;
  subjects: { id: number; name: string }[];
}

export async function getTaxonomyTree(): Promise<TaxonomyClass[]> {
  const classes = await listClasses();
  const allSubjects = await listSubjects();
  return classes.map(c => ({
    id: c.id,
    name: c.name,
    subjects: allSubjects.filter(s => s.classId === c.id).map(s => ({ id: s.id, name: s.name })),
  }));
}
