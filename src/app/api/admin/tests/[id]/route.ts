import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { updateTest, softDeleteTest } from "@/lib/legacy-admin";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  description: z.string().nullable().optional(),
  classId: z.number().int().positive().optional(),
  subjectId: z.number().int().positive().optional(),
  durationMinutes: z.number().int().positive().optional(),
  isFree: z.boolean().optional(),
  price: z.number().min(0).optional(),
  isPractice: z.boolean().optional(),
  randomizeQuestions: z.boolean().optional(),
  randomizeOptions: z.boolean().optional(),
  retakeCooldownDays: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const tid = Number(id);

    const rows = await prisma.$queryRaw<Array<{
      id: number; name: string; description: string | null;
      classId: number | null; subjectId: number | null;
      durationMinutes: number | null; isFree: number | boolean; price: unknown;
      isPractice: number | boolean; isActive: number | boolean;
      retakeCooldownDays: number | null;
      className: string | null; subjectName: string | null;
    }>>`
      SELECT t.id, t.name, t.description,
             t.classId, t.subjectId, t.durationMinutes,
             t.isFree, t.price, t.isPractice, t.isActive, t.retakeCooldownDays,
             c.name AS className, s.name AS subjectName
      FROM vw_tests t
      LEFT JOIN vw_classes c ON c.id = t.classId
      LEFT JOIN vw_subjects s ON s.id = t.subjectId
      WHERE t.id = ${tid} LIMIT 1
    `;
    if (!rows[0]) return error("Test not found", 404);

    const links = await prisma.$queryRaw<Array<{
      id: number; testId: number; questionId: number; marks: number | bigint;
      text: string | null; type: string;
    }>>`
      SELECT tq.id, tq.testId, tq.questionId, tq.marks, q.text, q.type
      FROM vw_test_questions tq
      INNER JOIN vw_questions q ON q.id = tq.questionId
      WHERE tq.testId = ${tid}
      ORDER BY tq.sortOrder
    `;

    const r = rows[0];
    return success({
      id: Number(r.id),
      name: r.name,
      description: r.description ?? null,
      durationMinutes: Number(r.durationMinutes) || 30,
      isFree: !!r.isFree,
      price: Number(r.price ?? 0),
      isPractice: !!r.isPractice,
      isActive: !!r.isActive,
      retakeCooldownDays: Number(r.retakeCooldownDays ?? 0),
      randomizeQuestions: true,
      randomizeOptions: true,
      classId: r.classId !== null ? Number(r.classId) : null,
      subjectId: r.subjectId !== null ? Number(r.subjectId) : null,
      class: r.classId !== null ? { id: Number(r.classId), name: r.className ?? "" } : null,
      subject: r.subjectId !== null ? { id: Number(r.subjectId), name: r.subjectName ?? "" } : null,
      questions: links.map(l => ({
        id: Number(l.id),
        testId: Number(l.testId),
        questionId: Number(l.questionId),
        sortOrder: 0,
        question: {
          id: Number(l.questionId),
          text: l.text ?? "",
          type: l.type,
          marks: Number(l.marks),
        },
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const body = await parseBody(request, updateSchema);
    await updateTest(Number(id), {
      name: body.name,
      description: body.description,
      classId: body.classId,
      subjectId: body.subjectId,
      durationMinutes: body.durationMinutes,
      price: body.price,
      retakeCooldownDays: body.retakeCooldownDays,
      isActive: body.isActive,
    });
    return success({ id: Number(id) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    await softDeleteTest(Number(id));
    return success({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
