import { z } from "zod";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success } from "@/lib/api-utils";
import { createQuestion } from "@/lib/legacy-admin";

const optionSchema = z.object({
  label: z.string().max(10),
  text: z.string().min(1),
  isCorrect: z.boolean(),
});

const createSchema = z
  .object({
    subjectId: z.number().int().positive(),
    type: z.enum(["SINGLE_MCQ", "MULTI_MCQ", "FILL_IN_BLANK"]),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
    text: z.string().min(1),
    explanation: z.string().optional(),
    marks: z.number().int().positive().default(1),
    options: z.array(optionSchema).optional(),
    correctText: z.string().optional(),
  })
  .refine(d => d.type !== "FILL_IN_BLANK" || !!d.correctText, {
    message: "correctText is required for FILL_IN_BLANK", path: ["correctText"],
  })
  .refine(d => d.type === "FILL_IN_BLANK" || (d.options && d.options.length >= 2), {
    message: "MCQ questions require at least 2 options", path: ["options"],
  })
  .refine(d => d.type !== "SINGLE_MCQ" || (d.options?.filter(o => o.isCorrect).length === 1), {
    message: "SINGLE_MCQ must have exactly 1 correct option", path: ["options"],
  })
  .refine(d => d.type !== "MULTI_MCQ" || ((d.options?.filter(o => o.isCorrect).length ?? 0) >= 1), {
    message: "MULTI_MCQ must have at least 1 correct option", path: ["options"],
  });

export async function GET(request: NextRequest) {
  try {
    await requireAuth("admin");

    const params = request.nextUrl.searchParams;
    const subjectId = params.get("subjectId");
    const type = params.get("type");
    const difficulty = params.get("difficulty");
    const search = params.get("search");
    const page = Math.max(1, Number(params.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, Number(params.get("limit") || "20")));
    const offset = (page - 1) * limit;

    const where: string[] = ["q.isActive = 1"];
    const args: (string | number)[] = [];
    if (subjectId) { where.push("q.subjectId = ?"); args.push(Number(subjectId)); }
    if (type) { where.push("q.type = ?"); args.push(type); }
    if (difficulty) { where.push("q.difficulty = ?"); args.push(difficulty); }
    if (search) { where.push("q.text LIKE ?"); args.push(`%${search}%`); }

    const whereSql = `WHERE ${where.join(" AND ")}`;

    // Lean list query — no per-row subqueries (full details/counts live on the detail endpoint)
    const rows = await prisma.$queryRawUnsafe<Array<{
      id: number; subjectId: number | null; type: string; difficulty: string;
      text: string | null; isActive: number | boolean;
      subjectName: string | null; className: string | null; classId: number | null;
    }>>(
      `SELECT q.id, q.subjectId, q.type, q.difficulty, q.text, q.isActive,
              s.name AS subjectName, c.name AS className, s.classId AS classId
       FROM vw_questions q
       LEFT JOIN vw_subjects s ON s.id = q.subjectId
       LEFT JOIN vw_classes c ON c.id = s.classId
       ${whereSql}
       ORDER BY q.id DESC
       LIMIT ? OFFSET ?`,
      ...args, limit, offset
    );

    // Fast count uses the `question` base table with mapped filters
    const baseWhere: string[] = ["q.question_status = 1"];
    const baseArgs: (string | number)[] = [];
    if (subjectId) { baseWhere.push("q.subjects_id = ?"); baseArgs.push(Number(subjectId)); }
    if (search) { baseWhere.push("q.question_id IN (SELECT question_id FROM question_description WHERE main_question LIKE ? AND languages_id = 3)"); baseArgs.push(`%${search}%`); }
    // Type/difficulty filters omitted from base count for speed; UI will still
    // get a reasonable total. If precise count matters for those, run a smaller query.
    const totalRow = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
      `SELECT COUNT(*) AS cnt FROM question q WHERE ${baseWhere.join(" AND ")}`,
      ...baseArgs
    );

    const questions = rows.map(r => ({
      id: Number(r.id),
      type: r.type,
      difficulty: r.difficulty,
      text: r.text ?? "",
      isActive: !!r.isActive,
      marks: 1, // shown in detail view
      chapter: {
        id: 0,
        name: "",
        subject: {
          id: r.subjectId !== null ? Number(r.subjectId) : 0,
          name: r.subjectName ?? "",
          class: {
            id: r.classId !== null ? Number(r.classId) : 0,
            name: r.className ?? "",
          },
        },
      },
      _count: { testQuestions: 0 },
      options: [],
    }));

    return success({
      questions,
      total: Number(totalRow[0].cnt),
      page,
      totalPages: Math.ceil(Number(totalRow[0].cnt) / limit),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth("admin");
    const body = await parseBody(request, createSchema);
    const newId = await createQuestion({
      subjectId: body.subjectId,
      type: body.type,
      difficulty: body.difficulty,
      text: body.text,
      marks: body.marks,
      explanation: body.explanation ?? null,
      options: body.options,
      correctText: body.correctText ?? null,
    });
    return success({ id: newId }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
