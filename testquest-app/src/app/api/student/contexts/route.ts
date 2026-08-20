import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { isValidBoardClass } from "@/lib/student-content";
import { listStudentContextCards } from "@/lib/student-context";

/**
 * Student board+class contexts (`tq_student_contexts`). Onboarding creates 1–2;
 * students add more anytime; a pass purchase auto-creates its context.
 *
 * A context is *browsing scope*, not entitlement — holding one grants nothing.
 * What a student may open is decided only by `hasClassAccess`, so adding a
 * class here can never leak paid content.
 *
 * Exactly one context is primary: it is the one the header opens on, and a
 * student with two primaries (or none) would land somewhere arbitrary.
 */

const createSchema = z.object({
  boardId: z.number().int().positive(),
  classId: z.number().int().positive(),
  isPrimary: z.boolean().optional(),
}).strict();

export async function GET() {
  try {
    const session = await requireAuth("student");
    // Shared with the `(student)` layout so the header the server renders and
    // the list this returns can never disagree.
    return success(await listStudentContextCards(session.id));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth("student");
    const body = await parseBody(request, createSchema);

    if (!(await isValidBoardClass(body.boardId, body.classId))) {
      return error("That board doesn't run that class", 404);
    }

    const existingCount = await prisma.studentContext.count({ where: { studentId: session.id } });
    // First context is always primary — otherwise the header has nothing to open on.
    const makePrimary = body.isPrimary ?? existingCount === 0;

    const ctx = await prisma.$transaction(async (tx) => {
      if (makePrimary) {
        await tx.studentContext.updateMany({
          where: { studentId: session.id, isPrimary: true },
          data: { isPrimary: false },
        });
      }
      return tx.studentContext.upsert({
        where: {
          studentId_boardId_classId: {
            studentId: session.id, boardId: body.boardId, classId: body.classId,
          },
        },
        create: {
          studentId: session.id,
          boardId: body.boardId,
          classId: body.classId,
          isPrimary: makePrimary,
        },
        update: makePrimary ? { isPrimary: true } : {},
      });
    });

    return success({ id: ctx.id, isPrimary: ctx.isPrimary }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAuth("student");
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isFinite(id)) return error("Invalid context id", 400);

    const ctx = await prisma.studentContext.findUnique({ where: { id } });
    if (!ctx || ctx.studentId !== session.id) return error("Context not found", 404);

    const count = await prisma.studentContext.count({ where: { studentId: session.id } });
    if (count <= 1) return error("You need at least one class — add another before removing this one", 400);

    await prisma.$transaction(async (tx) => {
      await tx.studentContext.delete({ where: { id } });
      // Removing the primary would leave the header with nothing to open on;
      // the oldest survivor takes over.
      if (ctx.isPrimary) {
        const next = await tx.studentContext.findFirst({
          where: { studentId: session.id },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });
        if (next) await tx.studentContext.update({ where: { id: next.id }, data: { isPrimary: true } });
      }
    });

    return success({ removed: true });
  } catch (err) {
    return handleApiError(err);
  }
}
