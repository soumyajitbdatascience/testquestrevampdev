import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success } from "@/lib/api-utils";

/**
 * Classes — the clean shared master (Class 6–12) from tq_classes.
 *
 * A class is board-agnostic: which boards offer it lives in tq_board_classes,
 * surfaced here as `boards` chips. The old legacy Subjects/Students/Tests
 * columns are gone — a subject no longer belongs to a class, and tests hang off
 * an offering, so those counts belong on the Offerings hub instead.
 */
const createSchema = z.object({
  name: z.string().min(1).max(100),
  sortOrder: z.number().int().optional(),
});

export async function GET() {
  try {
    await requireAuth("admin");

    const classes = await prisma.class.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        boardClasses: {
          where: { isActive: true },
          include: { board: { select: { id: true, code: true, name: true } } },
          orderBy: { board: { sortOrder: "asc" } },
        },
        _count: { select: { offerings: true } },
      },
    });

    return success(classes.map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sortOrder,
      isActive: c.isActive,
      legacyId: c.legacyId,
      boards: c.boardClasses.map((bc) => ({
        id: bc.board.id,
        code: bc.board.code,
        name: bc.board.name,
      })),
      _count: { offerings: c._count.offerings },
    })));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth("admin");
    const body = await parseBody(request, createSchema);

    const last = await prisma.class.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    const created = await prisma.class.create({
      data: { name: body.name, sortOrder: body.sortOrder ?? (last?.sortOrder ?? 0) + 1 },
    });

    return success({
      id: created.id,
      name: created.name,
      sortOrder: created.sortOrder,
      isActive: created.isActive,
      legacyId: created.legacyId,
      boards: [],
      _count: { offerings: 0 },
    }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
