import { z } from "zod";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success } from "@/lib/api-utils";

/**
 * Subjects — the clean shared master (8 rows) from tq_subjects.
 *
 * A subject is NOT tied to a class: "Mathematics" exists once and is reused by
 * every board and class through an Offering. This screen only names the shared
 * subjects; nothing hangs off a subject directly except the question bank.
 *
 * (The old version read `vw_subjects`, which surfaced 817 legacy test-sets —
 * "Class 9 English Set 1" — as if they were subjects. That is exactly what the
 * migration removed.)
 */
// `.strict()` matters here: a subject is a pure master with no class of its
// own, so a caller sending `classId` is working from the old flat model and
// must be told, not silently obeyed. Without it Zod would strip the field and
// the request would appear to succeed.
const createSchema = z.object({
  name: z.string().min(1).max(200),
  sortOrder: z.number().int().optional(),
}).strict();

export async function GET(request: NextRequest) {
  try {
    await requireAuth("admin");
    const search = request.nextUrl.searchParams.get("search");

    const subjects = await prisma.subject.findMany({
      where: search ? { name: { contains: search } } : undefined,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { offerings: true, questions: true } },
      },
    });

    return success(subjects.map((s) => ({
      id: s.id,
      name: s.name,
      sortOrder: s.sortOrder,
      isActive: s.isActive,
      _count: {
        offerings: s._count.offerings,
        questions: s._count.questions,
      },
    })));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth("admin");
    const body = await parseBody(request, createSchema);

    const last = await prisma.subject.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    const created = await prisma.subject.create({
      data: { name: body.name, sortOrder: body.sortOrder ?? (last?.sortOrder ?? 0) + 1 },
    });

    return success({
      id: created.id,
      name: created.name,
      sortOrder: created.sortOrder,
      isActive: created.isActive,
      _count: { offerings: 0, questions: 0 },
    }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
