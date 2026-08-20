import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

// Strict for the same reason as create: a subject has no class, so `classId`
// is rejected rather than quietly dropped.
const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
}).strict();

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;

    const subject = await prisma.subject.findUnique({
      where: { id: Number(id) },
      include: {
        offerings: {
          where: { isActive: true },
          include: {
            board: { select: { id: true, code: true } },
            class: { select: { id: true, name: true } },
          },
          orderBy: [{ boardId: "asc" }, { classId: "asc" }],
        },
        _count: { select: { questions: true } },
      },
    });
    if (!subject) return error("Subject not found", 404);

    return success({
      id: subject.id,
      name: subject.name,
      sortOrder: subject.sortOrder,
      isActive: subject.isActive,
      // Where this subject is actually offered — a subject has no single class.
      offerings: subject.offerings.map((o) => ({
        id: o.id,
        boardCode: o.board.code,
        classId: o.class.id,
        className: o.class.name,
      })),
      _count: { questions: subject._count.questions },
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
    const updated = await prisma.subject.update({ where: { id: Number(id) }, data: body });
    return success(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

/** Soft delete — isActive = false. */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    await prisma.subject.update({ where: { id: Number(id) }, data: { isActive: false } });
    return success({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
