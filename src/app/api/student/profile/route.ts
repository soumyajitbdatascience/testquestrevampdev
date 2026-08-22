import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { findById, updateStudent, setPrimaryContext } from "@/lib/students";
import { prisma } from "@/lib/db";

const updateSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  mobile: z.string().min(10).max(20).optional(),
  classId: z.number().int().positive().optional(),
  board: z.enum(["CBSE", "ICSE", "State"]).optional(),
});

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth("student");
    const body = await parseBody(request, updateSchema);

    await updateStudent(session.id, { name: body.name, mobile: body.mobile });

    // Board and class are a StudentContext, not columns on the student row, so
    // they are only set together.
    if (body.classId != null && body.board) {
      const [cls, board] = await Promise.all([
        prisma.class.findFirst({ where: { id: body.classId, isActive: true }, select: { id: true } }),
        prisma.board.findFirst({ where: { code: body.board.toUpperCase(), isActive: true }, select: { id: true } }),
      ]);
      if (!cls) return error("Invalid class", 422);
      if (!board) return error("Invalid board", 422);
      await setPrimaryContext(session.id, board.id, cls.id);
    }

    const student = await findById(session.id);
    if (!student) return error("Profile not found", 404);

    const ctx = student.primaryContext;
    const boardCode = ctx
      ? (await prisma.board.findUnique({ where: { id: ctx.boardId }, select: { code: true } }))?.code ?? null
      : null;

    return success({
      id: student.id,
      name: student.name,
      email: student.email,
      mobile: student.mobile,
      classId: ctx?.classId ?? null,
      boardId: ctx?.boardId ?? null,
      board: boardCode,
      avatarUrl: null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
