import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { updateQuestion, softDeleteQuestion } from "@/lib/legacy-admin";

type Params = { params: Promise<{ id: string }> };

const optionSchema = z.object({
  id: z.number().int().optional(),
  label: z.string().max(10),
  text: z.string().min(1),
  isCorrect: z.boolean(),
});

const updateSchema = z.object({
  subjectId: z.number().int().positive().optional(),
  type: z.enum(["SINGLE_MCQ", "MULTI_MCQ", "FILL_IN_BLANK"]).optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  text: z.string().min(1).optional(),
  explanation: z.string().nullable().optional(),
  marks: z.number().int().positive().optional(),
  correctText: z.string().nullable().optional(),
  options: z.array(optionSchema).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const qid = Number(id);

    const rows = await prisma.$queryRaw<Array<{
      id: number; subjectId: number | null; type: string; difficulty: string;
      text: string | null; isActive: number | boolean;
      explanation: string | null; marks: number | bigint;
      subjectName: string | null; className: string | null; classId: number | null;
    }>>`
      SELECT q.id, q.subjectId, q.type, q.difficulty, q.text, q.isActive,
             m.explanation, COALESCE(m.marks, 1) AS marks,
             s.name AS subjectName, c.name AS className, s.classId AS classId
      FROM vw_questions q
      LEFT JOIN vw_question_meta m ON m.questionId = q.id
      LEFT JOIN vw_subjects s ON s.id = q.subjectId
      LEFT JOIN vw_classes c ON c.id = s.classId
      WHERE q.id = ${qid} LIMIT 1
    `;
    if (!rows[0]) return error("Question not found", 404);

    const opts = await prisma.$queryRaw<Array<{
      id: number; label: string; text: string; isCorrect: number | boolean; sortOrder: number;
    }>>`
      SELECT id, label, text, isCorrect, sortOrder
      FROM vw_question_options WHERE questionId = ${qid} ORDER BY sortOrder
    `;

    const r = rows[0];
    return success({
      id: Number(r.id),
      type: r.type,
      difficulty: r.difficulty,
      text: r.text ?? "",
      explanation: r.explanation ?? null,
      marks: Number(r.marks),
      isActive: !!r.isActive,
      subjectId: r.subjectId !== null ? Number(r.subjectId) : null,
      chapter: {
        id: 0, name: "",
        subject: {
          id: r.subjectId !== null ? Number(r.subjectId) : 0,
          name: r.subjectName ?? "",
          class: {
            id: r.classId !== null ? Number(r.classId) : 0,
            name: r.className ?? "",
          },
        },
      },
      options: opts.map(o => ({
        id: Number(o.id),
        label: o.label,
        text: o.text ?? "",
        isCorrect: !!o.isCorrect,
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

    await updateQuestion(Number(id), {
      subjectId: body.subjectId,
      type: body.type,
      difficulty: body.difficulty,
      text: body.text,
      marks: body.marks,
      explanation: body.explanation,
      options: body.options,
      correctText: body.correctText,
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
    await softDeleteQuestion(Number(id));
    return success({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
