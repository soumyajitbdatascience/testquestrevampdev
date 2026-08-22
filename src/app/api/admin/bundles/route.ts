import { z } from "zod";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";

const createSchema = z.object({
  name: z.string().min(1).max(300),
  description: z.string().optional(),
  price: z.number().positive(),
  validityDays: z.number().int().positive(),
  classId: z.number().int().positive().optional(),
  testIds: z.array(z.number().int().positive()).min(1),
});

async function validateTestIds(testIds: number[]): Promise<{ valid: true } | { valid: false; missing: number[] }> {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `SELECT id FROM vw_tests WHERE id IN (${testIds.map(() => "?").join(",")})`,
    ...testIds,
  );
  const found = new Set(rows.map((r) => Number(r.id)));
  const missing = testIds.filter((id) => !found.has(id));
  if (missing.length) return { valid: false, missing };
  return { valid: true };
}

async function hydrateBundleTests<T extends { id: number; tests: Array<{ id: number; testId: number }> }>(bundles: T[]) {
  const allTestIds = Array.from(new Set(bundles.flatMap((b) => b.tests.map((t) => Number(t.testId)))));
  if (allTestIds.length === 0) return bundles.map((b) => ({ ...b, tests: [] as Array<unknown> }));
  const rows = await prisma.$queryRawUnsafe<Array<{
    id: number; name: string; classId: number | null; className: string | null;
    subjectId: number | null; subjectName: string | null;
  }>>(
    `SELECT t.id, t.name, t.classId, c.name AS className, t.subjectId, s.name AS subjectName
     FROM vw_tests t
     LEFT JOIN vw_classes c ON c.id = t.classId
     LEFT JOIN vw_subjects s ON s.id = t.subjectId
     WHERE t.id IN (${allTestIds.map(() => "?").join(",")})`,
    ...allTestIds,
  );
  const byId = new Map(rows.map((r) => [Number(r.id), r]));
  return bundles.map((b) => ({
    ...b,
    tests: b.tests.map((bt) => {
      const meta = byId.get(Number(bt.testId));
      return {
        id: bt.id,
        testId: Number(bt.testId),
        test: meta
          ? {
              id: Number(meta.id),
              name: meta.name,
              class: meta.classId ? { id: Number(meta.classId), name: meta.className } : null,
              subject: meta.subjectId ? { id: Number(meta.subjectId), name: meta.subjectName } : null,
            }
          : null,
      };
    }),
  }));
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth("admin");

    const page = Number(request.nextUrl.searchParams.get("page") || "1");
    const limit = Number(request.nextUrl.searchParams.get("limit") || "20");

    const [bundles, total] = await Promise.all([
      // Bundles are retired in the decoupled model (no tq_bundles table here);
      // the class and order relations no longer exist on the model.
      prisma.bundle.findMany({
        include: { tests: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.bundle.count(),
    ]);

    const hydrated = await hydrateBundleTests(bundles);
    return success({ bundles: hydrated, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth("admin");
    const body = await parseBody(request, createSchema);

    const { testIds, ...bundleData } = body;

    const check = await validateTestIds(testIds);
    if (!check.valid) {
      return error(`Invalid testId(s): ${check.missing.join(", ")}`, 422);
    }

    const bundle = await prisma.bundle.create({
      data: {
        ...bundleData,
        tests: {
          create: testIds.map((testId) => ({ testId })),
        },
      },
      include: { tests: true },
    });

    const [hydrated] = await hydrateBundleTests([bundle]);
    return success(hydrated, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
