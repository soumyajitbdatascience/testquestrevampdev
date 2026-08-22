import { z } from "zod";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

/**
 * Tests belonging to one offering.
 *
 * `isActive` is the live/draft switch: a draft is built up and only goes live
 * once it has questions. `totalMarks` is never set by hand — it is always the
 * sum of the marks of the questions actually in the test, recomputed whenever
 * the question set changes (see ./[testId]/questions).
 */
const createSchema = z.object({
  name: z.string().min(1).max(300),
  description: z.string().optional(),
  durationMinutes: z.number().int().min(1).max(600),
  isPractice: z.boolean().default(false),
  isFree: z.boolean().default(false),
  isActive: z.boolean().default(false),
});

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const offeringId = Number(id);
    if (!Number.isFinite(offeringId)) return error("Invalid offering id", 400);

    const search = (request.nextUrl.searchParams.get("search") ?? "").trim();

    const tests = await prisma.test.findMany({
      where: { offeringId, ...(search ? { name: { contains: search } } : {}) },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: {
        _count: { select: { questions: true, attempts: true } },
        freeTests: { select: { id: true } },
      },
    });

    return success(tests.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      durationMinutes: t.durationMinutes,
      totalMarks: t.totalMarks,
      isFree: t.isFree,
      isPractice: t.isPractice,
      isActive: t.isActive,
      legacyId: t.legacyId,
      questionCount: t._count.questions,
      attemptCount: t._count.attempts,
      isFreeSample: t.freeTests.length > 0,
    })));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const offeringId = Number(id);

    const offering = await prisma.offering.findUnique({ where: { id: offeringId }, select: { id: true } });
    if (!offering) return error("Offering not found", 404);

    const body = await parseBody(request, createSchema);

    const created = await prisma.test.create({
      data: {
        offeringId,
        name: body.name,
        description: body.description ?? null,
        durationMinutes: body.durationMinutes,
        isPractice: body.isPractice,
        isFree: body.isFree,
        // A brand-new test has no questions, so it starts as a draft whatever
        // was asked for — going live with an empty test would strand students.
        isActive: false,
        totalMarks: 0,
      },
      select: { id: true, name: true },
    });

    return success(created, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
