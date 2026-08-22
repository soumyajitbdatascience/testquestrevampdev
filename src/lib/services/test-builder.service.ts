/**
 * test-builder service — Phase 2 / Task 2.2.
 *
 * The custom-test builder reads from Testquest's bank (via vw_questions /
 * vw_question_options / vw_subjects) and writes to legacy main_exam tables
 * through `legacy-admin.createTest()` + `setTestQuestions()`. The new bit is
 * the `tq_org_tests` mapping that marks each created test as private to the
 * authoring org.
 *
 * 2.2 deliberately keeps the picker to Testquest-bank questions only. The
 * org-private bank from `tq_org_questions` mixes in at 2.4.
 */
import { prisma } from "@/lib/db";
import { createTest, setTestQuestions, type AdminQuestionType, type AdminDifficulty } from "@/lib/legacy-admin";

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 60;

// ─── Search ────────────────────────────────────────────────────────

export type QuestionSource = "ALL" | "TESTQUEST" | "MINE";

export interface QuestionSearchInput {
  /** The org running the picker. Used for source-tagging and cross-org exclusion. */
  orgId: number;
  classId: number;
  subjectIds?: number[];
  difficulty?: AdminDifficulty | "ALL";
  type?: AdminQuestionType | "ALL";
  query?: string;
  /** Phase 2 / Task 2.4 — bank source filter. Default ALL. */
  source?: QuestionSource;
  limit?: number;
  offset?: number;
}

export interface QuestionRow {
  id: number;
  subjectId: number | null;
  subjectName: string | null;
  text: string;
  type: AdminQuestionType | "PARAGRAPH";
  difficulty: AdminDifficulty;
  optionCount: number;
  /** "TESTQUEST" = public Testquest-bank question; "MINE" = in this org's tq_org_questions. */
  source: "TESTQUEST" | "MINE";
}

export interface QuestionSearchResult {
  rows: QuestionRow[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Search the question picker.
 *
 * Source semantics (Phase 2 / Task 2.4):
 *   - "ALL"       — Testquest public + this org's private. Other orgs' private
 *                   questions are excluded.
 *   - "TESTQUEST" — only Testquest public questions (no row in tq_org_questions).
 *   - "MINE"      — only this org's private questions.
 *
 * Each row is tagged with `source` via a LEFT JOIN to tq_org_questions
 * filtered by the calling org. We use one consistent FROM/JOIN/WHERE shape
 * so the COUNT and SELECT can share `args`.
 *
 * Only returns active questions that match the picker's supported types
 * (single/multi MCQ + fill-in-blank — paragraphs excluded for MVP).
 */
export async function searchQuestions(input: QuestionSearchInput): Promise<QuestionSearchResult> {
  const limit = Math.min(PAGE_SIZE_MAX, Math.max(1, input.limit ?? PAGE_SIZE_DEFAULT));
  const offset = Math.max(0, input.offset ?? 0);
  const source: QuestionSource = input.source ?? "ALL";

  // Class scoping goes via subject → class, since vw_questions doesn't carry
  // classId directly. vw_subjects has classId.
  const where: string[] = [
    "q.isActive = 1",
    "q.type IN ('SINGLE_MCQ','MULTI_MCQ','FILL_IN_BLANK')",
    "s.classId = ?",
  ];
  const args: (string | number)[] = [input.classId];

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

  // Source filter / privacy fix.
  if (source === "MINE") {
    where.push("oqOwn.id IS NOT NULL");
  } else if (source === "TESTQUEST") {
    // No mapping row exists at all (no org owns this question).
    where.push(`NOT EXISTS (SELECT 1 FROM tq_org_questions otAny WHERE otAny.legacyQuestionId = q.id AND otAny.isActive = TRUE)`);
  } else {
    // ALL: include Testquest public + this org's own, exclude other orgs'.
    where.push(`NOT EXISTS (SELECT 1 FROM tq_org_questions otOther WHERE otOther.legacyQuestionId = q.id AND otOther.isActive = TRUE AND otOther.orgId <> ?)`);
    args.push(input.orgId);
  }

  const whereSql = where.join(" AND ");

  // `oqOwn` is the per-row tag JOIN — always present so we can emit `source`
  // on the result, regardless of the filter mode.
  const fromJoin = `
    FROM vw_questions q
    INNER JOIN vw_subjects s ON s.id = q.subjectId
    LEFT JOIN tq_org_questions oqOwn
      ON oqOwn.legacyQuestionId = q.id
     AND oqOwn.orgId = ?
     AND oqOwn.isActive = TRUE
  `;
  // The LEFT JOIN's predicate uses `orgId = ?` which is bound first; all the
  // remaining args follow.
  const argsWithJoinFirst = [input.orgId, ...args];

  const rows = await prisma.$queryRawUnsafe<Array<{
    id: number;
    subjectId: number | null;
    subjectName: string | null;
    text: string | null;
    type: string;
    difficulty: string;
    optionCount: bigint;
    isMine: number | boolean;
  }>>(
    `SELECT q.id, q.subjectId, s.name AS subjectName,
            q.text, q.type, q.difficulty,
            (SELECT COUNT(*) FROM vw_question_options o WHERE o.questionId = q.id) AS optionCount,
            (oqOwn.id IS NOT NULL) AS isMine
     ${fromJoin}
     WHERE ${whereSql}
     ORDER BY q.id DESC
     LIMIT ? OFFSET ?`,
    ...argsWithJoinFirst, limit, offset,
  );

  const totalRow = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
    `SELECT COUNT(*) AS cnt
     ${fromJoin}
     WHERE ${whereSql}`,
    ...argsWithJoinFirst,
  );

  return {
    rows: rows.map((r) => ({
      id: Number(r.id),
      subjectId: r.subjectId !== null ? Number(r.subjectId) : null,
      subjectName: r.subjectName,
      text: stripHtml(r.text ?? "") || `Question ${Number(r.id)}`,
      type: r.type as QuestionRow["type"],
      difficulty: r.difficulty as AdminDifficulty,
      optionCount: Number(r.optionCount),
      source: r.isMine ? "MINE" : "TESTQUEST",
    })),
    total: Number(totalRow[0]?.cnt ?? 0),
    limit,
    offset,
  };
}

// ─── Detail (for inline preview) ───────────────────────────────────

export interface QuestionDetailOption {
  label: string;
  text: string;
  isCorrect: boolean;
}
/**
 * Detail shape for inline preview. We deliberately Omit `source` from the
 * picker row type so the detail endpoint can stay org-agnostic — the
 * caller already knows whether they own the question via the picker row
 * that surfaced it.
 */
export interface QuestionDetail extends Omit<QuestionRow, "source"> {
  options: QuestionDetailOption[];
}

export async function getQuestionDetail(questionId: number): Promise<QuestionDetail | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{
    id: number;
    subjectId: number | null;
    subjectName: string | null;
    text: string | null;
    type: string;
    difficulty: string;
  }>>(
    `SELECT q.id, q.subjectId, s.name AS subjectName, q.text, q.type, q.difficulty
     FROM vw_questions q
     LEFT JOIN vw_subjects s ON s.id = q.subjectId
     WHERE q.id = ? AND q.isActive = 1
     LIMIT 1`,
    questionId,
  );
  const r = rows[0];
  if (!r) return null;
  const opts = await prisma.$queryRawUnsafe<Array<{
    label: string; text: string | null; isCorrect: number | boolean;
  }>>(
    `SELECT label, text, isCorrect
     FROM vw_question_options
     WHERE questionId = ?
     ORDER BY sortOrder`,
    questionId,
  );
  return {
    id: Number(r.id),
    subjectId: r.subjectId !== null ? Number(r.subjectId) : null,
    subjectName: r.subjectName,
    text: stripHtml(r.text ?? "") || `Question ${Number(r.id)}`,
    type: r.type as QuestionRow["type"],
    difficulty: r.difficulty as AdminDifficulty,
    optionCount: opts.length,
    options: opts.map((o) => ({
      label: o.label,
      text: stripHtml(o.text ?? ""),
      isCorrect: !!o.isCorrect,
    })),
  };
}

// ─── Create + list ─────────────────────────────────────────────────

export interface CreateOrgTestInput {
  orgId: number;
  createdBy: number;
  name: string;
  description?: string | null;
  classId: number;
  subjectId: number;
  durationMinutes: number;
  passingPercentage?: number;
  questionIds: number[];
}

export class TestBuilderError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

export async function createOrgTest(input: CreateOrgTestInput): Promise<{ id: number }> {
  if (input.name.trim().length < 3) {
    throw new TestBuilderError("BAD_NAME", "Give the test a name (at least 3 characters).");
  }
  if (input.questionIds.length < 1) {
    throw new TestBuilderError("NO_QUESTIONS", "Add at least one question.");
  }
  if (input.questionIds.length > 200) {
    throw new TestBuilderError("TOO_MANY", "Tests are capped at 200 questions for now.");
  }
  if (input.durationMinutes < 5 || input.durationMinutes > 360) {
    throw new TestBuilderError("BAD_DURATION", "Duration must be between 5 and 360 minutes.");
  }

  // Sanity check: every picked question actually exists and is active.
  const placeholders = input.questionIds.map(() => "?").join(",");
  const valid = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `SELECT id FROM vw_questions WHERE id IN (${placeholders}) AND isActive = 1`,
    ...input.questionIds,
  );
  if (valid.length !== input.questionIds.length) {
    throw new TestBuilderError("STALE_QUESTIONS", "Some questions are no longer available. Refresh and try again.");
  }

  // 1) Legacy write (no Prisma transaction — these are raw SQL on the legacy
  //    schema, just like signup).
  const legacyTestId = await createTest({
    name: input.name.trim(),
    description: input.description?.trim() || null,
    classId: input.classId,
    subjectId: input.subjectId,
    durationMinutes: input.durationMinutes,
    passingPercentage: input.passingPercentage ?? 0,
    questionIds: input.questionIds,
    isActive: true,
  });

  // 2) Org mapping (Prisma-managed table).
  await prisma.orgTest.create({
    data: {
      orgId: input.orgId,
      legacyTestId,
      createdBy: input.createdBy,
    },
  });

  return { id: legacyTestId };
}

export interface OrgTestSummary {
  id: number;
  legacyTestId: number;
  name: string;
  className: string | null;
  subjectName: string | null;
  durationMinutes: number;
  questionCount: number;
  totalMarks: number;
  createdAt: Date;
  assignmentCount: number;
}

export async function listOrgTests(orgId: number): Promise<OrgTestSummary[]> {
  const mappings = await prisma.orgTest.findMany({
    where: { orgId, isActive: true },
    orderBy: { createdAt: "desc" },
  });
  if (mappings.length === 0) return [];

  const testIds = mappings.map((m) => m.legacyTestId);
  const placeholders = testIds.map(() => "?").join(",");
  const tests = await prisma.$queryRawUnsafe<Array<{
    id: number; name: string;
    classId: number | null; className: string | null;
    subjectId: number | null; subjectName: string | null;
    durationMinutes: number;
    questionCount: bigint; totalMarks: bigint;
  }>>(
    `SELECT t.id, t.name,
            t.classId, c.name AS className,
            t.subjectId, s.name AS subjectName,
            t.durationMinutes,
            (SELECT COUNT(*) FROM vw_test_questions q WHERE q.testId = t.id) AS questionCount,
            (SELECT COALESCE(SUM(q.marks), 0) FROM vw_test_questions q WHERE q.testId = t.id) AS totalMarks
     FROM vw_tests t
     LEFT JOIN vw_classes c ON c.id = t.classId
     LEFT JOIN vw_subjects s ON s.id = t.subjectId
     WHERE t.id IN (${placeholders})`,
    ...testIds,
  );

  // Assignment counts in one query so the list page doesn't N+1.
  const counts = await prisma.assignment.groupBy({
    by: ["testId"],
    where: { orgId, testId: { in: testIds } },
    _count: { testId: true },
  });
  const countByTest = new Map(counts.map((c) => [c.testId, c._count.testId]));

  const byId = new Map(tests.map((t) => [Number(t.id), t]));
  return mappings
    .map((m) => {
      const t = byId.get(m.legacyTestId);
      if (!t) return null;
      return {
        id: m.id,
        legacyTestId: m.legacyTestId,
        name: stripHtml(t.name) || `Test ${m.legacyTestId}`,
        className: t.className,
        subjectName: t.subjectName,
        durationMinutes: Number(t.durationMinutes) || 0,
        questionCount: Number(t.questionCount),
        totalMarks: Number(t.totalMarks),
        createdAt: m.createdAt,
        assignmentCount: countByTest.get(m.legacyTestId) ?? 0,
      };
    })
    .filter((x): x is OrgTestSummary => x !== null);
}

// ─── Utility ───────────────────────────────────────────────────────

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
}

// Re-export setTestQuestions in case callers need to rewire later.
export { setTestQuestions };
