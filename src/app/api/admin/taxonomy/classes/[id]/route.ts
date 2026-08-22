import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;

    const cls = await prisma.class.findUnique({
      where: { id: Number(id) },
      include: {
        boardClasses: {
          where: { isActive: true },
          include: { board: { select: { id: true, code: true, name: true } } },
          orderBy: { board: { sortOrder: "asc" } },
        },
        offerings: {
          where: { isActive: true },
          include: {
            board: { select: { id: true, code: true } },
            subject: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!cls) return error("Class not found", 404);

    return success({
      id: cls.id,
      name: cls.name,
      sortOrder: cls.sortOrder,
      isActive: cls.isActive,
      legacyId: cls.legacyId,
      boards: cls.boardClasses.map((bc) => ({
        id: bc.board.id,
        code: bc.board.code,
        name: bc.board.name,
      })),
      // Offerings replace the old "subjects of this class" list — the same
      // subject can appear under several boards.
      offerings: cls.offerings.map((o) => ({
        id: o.id,
        boardCode: o.board.code,
        subjectId: o.subject.id,
        subjectName: o.subject.name,
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
    const updated = await prisma.class.update({ where: { id: Number(id) }, data: body });
    return success(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

/** Soft delete — isActive = false. Content stays reachable via its offerings. */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    await prisma.class.update({ where: { id: Number(id) }, data: { isActive: false } });
    return success({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
