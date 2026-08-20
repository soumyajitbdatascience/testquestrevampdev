import { z } from "zod";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { hasDeadImage, hasUnrenderableMath } from "@/lib/sanitize-html";
import type { Prisma } from "@/generated/prisma/client";

type Params = { params: Promise<{ id: string }> };

/**
 * The offering's question bank.
 *
 * Questions live in a SHARED pool keyed by subject — every class offering
 * "Mathematics" draws on the same rows. What binds a question to THIS shelf is
 * its chapter, which belongs to the offering.
 *
 * So `scope` decides what you're looking at:
 *   offering (default) — questions carrying one of this offering's chapters.
 *                        This is the shelf's own content.
 *   subject            — the whole shared pool for the subject, across every
 *                        class that offers it. Use it to pull an existing
 *                        question onto this shelf, or to find untagged ones.
 *
 * Defaulting to `offering` matters: CBSE Class 10 Maths shares its subject
 * with Classes 6–9, so a subject-wide default would show ~1,350 questions when
 * only ~750 are actually Class 10's.
 *
 * Always server-paginated: the pool runs to thousands of rows and the shared
 * host enforces a 10-second statement ceiling.
 */
const PAGE_SIZE_MAX = 100;

const optionSchema = z.object({
  label: z.string().min(1).max(10),
  text: z.string().min(1),
  isCorrect: z.boolean(),
});

const createSchema = z
  .object({
    chapterId: z.number().int().positive().nullable().optional(),
    type: z.enum(["SINGLE_MCQ", "MULTI_MCQ", "FILL_IN_BLANK"]),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
    text: z.string().min(1),
    explanation: z.string().optional(),
    marks: z.number().int().positive().default(1),
    options: z.array(optionSchema).optional(),
    correctText: z.string().optional(),
  })
  .refine((d) => d.type !== "FILL_IN_BLANK" || !!d.correctText, {
    message: "An accepted answer is required for fill-in-the-blank", path: ["correctText"],
  })
  .refine((d) => d.type === "FILL_IN_BLANK" || (d.options && d.options.length >= 2), {
    message: "MCQ questions need at least 2 options", path: ["options"],
  })
  .refine((d) => d.type !== "SINGLE_MCQ" || d.options?.filter((o) => o.isCorrect).length === 1, {
    message: "A single-answer MCQ needs exactly 1 correct option", path: ["options"],
  })
  .refine((d) => d.type !== "MULTI_MCQ" || (d.options?.filter((o) => o.isCorrect).length ?? 0) >= 2, {
    message: "A multi-answer MCQ needs at least 2 correct options", path: ["options"],
  });

export async function GET(request: NextRequest, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const offeringId = Number(id);
    if (!Number.isFinite(offeringId)) return error("Invalid offering id", 400);

    const offering = await prisma.offering.findUnique({
      where: { id: offeringId },
      select: { id: true, subjectId: true },
    });
    if (!offering) return error("Offering not found", 404);

    const p = request.nextUrl.searchParams;
    const page = Math.max(1, Number(p.get("page") || "1"));
    const limit = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(p.get("limit") || "25")));
    const search = (p.get("search") ?? "").trim();
    const type = p.get("type");
    const difficulty = p.get("difficulty");
    const chapterParam = p.get("chapterId");
    const scope = p.get("scope") === "subject" ? "subject" : "offering";

    const where: Prisma.QuestionWhereInput = {
      isActive: true,
      ...(type ? { type: type as Prisma.EnumQuestionTypeFilter["equals"] } : {}),
      ...(difficulty ? { difficulty: difficulty as Prisma.EnumDifficultyFilter["equals"] } : {}),
      ...(search ? { text: { contains: search } } : {}),
    };

    if (scope === "offering") {
      // This shelf's own content.
      where.chapter = { offeringId };
      if (chapterParam && chapterParam !== "none" && chapterParam !== "other") {
        where.chapterId = Number(chapterParam);
      }
    } else {
      // The whole shared pool for the subject.
      where.subjectId = offering.subjectId;
      // "none" = untagged; "other" = tagged to a different offering's chapter.
      if (chapterParam === "none") where.chapterId = null;
      else if (chapterParam === "other") where.chapter = { offeringId: { not: offeringId } };
      else if (chapterParam) where.chapterId = Number(chapterParam);
    }

    const [total, rows] = await Promise.all([
      prisma.question.count({ where }),
      prisma.question.findMany({
        where,
        orderBy: { id: "asc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          chapter: { select: { id: true, name: true, offeringId: true } },
          options: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, label: true, text: true, isCorrect: true } },
          _count: { select: { testQuestions: true } },
        },
      }),
    ]);

    return success({
      questions: rows.map((q) => ({
        id: q.id,
        type: q.type,
        difficulty: q.difficulty,
        text: q.text,
        explanation: q.explanation,
        correctText: q.correctText,
        marks: q.marks,
        legacyId: q.legacyId,
        chapter: q.chapter
          ? { id: q.chapter.id, name: q.chapter.name, isThisOffering: q.chapter.offeringId === offeringId }
          : null,
        options: q.options,
        usedInTests: q._count.testQuestions,
        // Known content defects, so the table can badge them and Launch
        // Readiness can roll them into the needs-attention tray.
        flags: {
          unrenderableMath: hasUnrenderableMath(q.text) || q.options.some((o) => hasUnrenderableMath(o.text)),
          deadImage: hasDeadImage(q.text) || q.options.some((o) => hasDeadImage(o.text)),
        },
      })),
      total,
      page,
      limit,
      scope,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const offeringId = Number(id);

    const offering = await prisma.offering.findUnique({
      where: { id: offeringId },
      select: { id: true, subjectId: true },
    });
    if (!offering) return error("Offering not found", 404);

    const body = await parseBody(request, createSchema);

    if (body.chapterId != null) {
      const chapter = await prisma.chapter.findFirst({
        where: { id: body.chapterId, offeringId },
        select: { id: true },
      });
      if (!chapter) return error("That chapter is not in this offering", 400);
    }

    const created = await prisma.question.create({
      data: {
        subjectId: offering.subjectId,
        chapterId: body.chapterId ?? null,
        type: body.type,
        difficulty: body.difficulty,
        text: body.text,
        explanation: body.explanation ?? null,
        correctText: body.correctText ?? null,
        marks: body.marks,
        options: body.options
          ? {
              create: body.options.map((o, i) => ({
                label: o.label, text: o.text, isCorrect: o.isCorrect, sortOrder: i + 1,
              })),
            }
          : undefined,
      },
      select: { id: true },
    });

    return success({ id: created.id }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
