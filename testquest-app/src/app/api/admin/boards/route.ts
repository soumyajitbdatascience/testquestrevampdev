import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success } from "@/lib/api-utils";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(20),
  sortOrder: z.number().int().optional(),
});

/** Boards admin: list includes active-pass counts for the deactivate guard. */
export async function GET() {
  try {
    await requireAuth("admin");
    const boards = await prisma.board.findMany({ orderBy: { sortOrder: "asc" } });
    const now = new Date();
    const counts = await prisma.classAccess.groupBy({
      by: ["boardId"],
      where: { expiresAt: { gt: now } },
      _count: { id: true },
    });
    const passCounts = new Map(counts.map((c) => [c.boardId, c._count.id]));
    return success(boards.map((b) => ({
      ...b,
      activePasses: passCounts.get(b.id) ?? 0,
    })));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth("admin");
    const body = await parseBody(request, createSchema);
    const board = await prisma.board.create({
      data: { name: body.name, code: body.code.toUpperCase(), sortOrder: body.sortOrder ?? 0 },
    });
    return success(board, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
