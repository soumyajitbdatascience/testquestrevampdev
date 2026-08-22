import { z } from "zod";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success } from "@/lib/api-utils";
import { createTest } from "@/lib/legacy-admin";

const createSchema = z.object({
  classId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  name: z.string().min(1).max(300),
  description: z.string().optional(),
  durationMinutes: z.number().int().positive(),
  isFree: z.boolean().default(false),
  price: z.number().min(0).default(0),
  isPractice: z.boolean().default(false),
  randomizeQuestions: z.boolean().default(true),
  randomizeOptions: z.boolean().default(true),
  retakeCooldownDays: z.number().int().min(0).default(0),
  questionIds: z.array(z.number().int().positive()).min(1),
});

export async function GET(request: NextRequest) {
  try {
    await requireAuth("admin");

    const params = request.nextUrl.searchParams;
    const classId = params.get("classId");
    const subjectId = params.get("subjectId");
    const search = params.get("search");
    const page = Math.max(1, Number(params.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, Number(params.get("limit") || "20")));
    const offset = (page - 1) * limit;

    const where: string[] = [];
    const args: (string | number)[] = [];
    if (classId) { where.push("t.classId = ?"); args.push(Number(classId)); }
    if (subjectId) { where.push("t.subjectId = ?"); args.push(Number(subjectId)); }
    if (search) { where.push("t.name LIKE ?"); args.push(`%${search}%`); }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const rows = await prisma.$queryRawUnsafe<Array<{
      id: number; name: string; classId: number | null; subjectId: number | null;
      durationMinutes: number | null; isFree: number | boolean; price: unknown;
      isPractice: number | boolean; isActive: number | boolean;
      className: string | null; subjectName: string | null;
      questionCount: bigint; attemptCount: bigint;
    }>>(
      `SELECT t.id, t.name, t.classId, t.subjectId,
              t.durationMinutes, t.isFree, t.price, t.isPractice, t.isActive,
              c.name AS className, s.name AS subjectName,
              (SELECT COUNT(*) FROM vw_test_questions tq WHERE tq.testId = t.id) AS questionCount,
              (SELECT COUNT(*) FROM vw_attempts_legacy a WHERE a.testId = t.id) AS attemptCount
       FROM vw_tests t
       LEFT JOIN vw_classes c ON c.id = t.classId
       LEFT JOIN vw_subjects s ON s.id = t.subjectId
       ${whereSql}
       ORDER BY t.id DESC
       LIMIT ? OFFSET ?`,
      ...args, limit, offset
    );

    const totalRow = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
      `SELECT COUNT(*) AS cnt FROM vw_tests t ${whereSql}`,
      ...args
    );

    const tests = rows.map(r => ({
      id: Number(r.id),
      name: r.name,
      durationMinutes: Number(r.durationMinutes) || 30,
      totalMarks: 0,
      isFree: !!r.isFree,
      price: Number(r.price ?? 0),
      isPractice: !!r.isPractice,
      isActive: !!r.isActive,
      class: r.classId !== null ? { id: Number(r.classId), name: r.className ?? "" } : null,
      subject: r.subjectId !== null ? { id: Number(r.subjectId), name: r.subjectName ?? "" } : null,
      _count: {
        questions: Number(r.questionCount),
        attempts: Number(r.attemptCount),
      },
    }));

    return success({
      tests,
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

    // Verify all questions exist in vw_questions
    const placeholders = body.questionIds.map(() => "?").join(",");
    const found = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
      `SELECT id FROM vw_questions WHERE id IN (${placeholders})`,
      ...body.questionIds
    );
    const foundSet = new Set(found.map(r => Number(r.id)));
    const missing = body.questionIds.filter(id => !foundSet.has(id));
    if (missing.length > 0) {
      return success({ error: `Questions not found: ${missing.join(", ")}` }, 422);
    }

    const newId = await createTest({
      name: body.name,
      description: body.description ?? null,
      classId: body.classId,
      subjectId: body.subjectId,
      durationMinutes: body.durationMinutes,
      isFree: body.isFree,
      price: body.price,
      retakeCooldownDays: body.retakeCooldownDays,
      questionIds: body.questionIds,
      isActive: true,
    });

    return success({ id: newId, name: body.name }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
