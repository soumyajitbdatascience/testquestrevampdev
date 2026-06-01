import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  description: z.string().nullable().optional(),
  price: z.number().positive().optional(),
  validityDays: z.number().int().positive().optional(),
  classId: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  testIds: z.array(z.number().int().positive()).optional(),
});

async function validateTestIds(testIds: number[]): Promise<{ valid: true } | { valid: false; missing: number[] }> {
  if (testIds.length === 0) return { valid: true };
  const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `SELECT id FROM vw_tests WHERE id IN (${testIds.map(() => "?").join(",")})`,
    ...testIds,
  );
  const found = new Set(rows.map((r) => Number(r.id)));
  const missing = testIds.filter((id) => !found.has(id));
  if (missing.length) return { valid: false, missing };
  return { valid: true };
}

async function hydrateTests(bundleTests: Array<{ id: number; testId: number }>) {
  if (bundleTests.length === 0) return [];
  const ids = bundleTests.map((t) => Number(t.testId));
  const rows = await prisma.$queryRawUnsafe<Array<{
    id: number; name: string; classId: number | null; className: string | null;
    subjectId: number | null; subjectName: string | null;
  }>>(
    `SELECT t.id, t.name, t.classId, c.name AS className, t.subjectId, s.name AS subjectName
     FROM vw_tests t
     LEFT JOIN vw_classes c ON c.id = t.classId
     LEFT JOIN vw_subjects s ON s.id = t.subjectId
     WHERE t.id IN (${ids.map(() => "?").join(",")})`,
    ...ids,
  );
  const byId = new Map(rows.map((r) => [Number(r.id), r]));
  return bundleTests.map((bt) => {
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
  });
}

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const bundle = await prisma.bundle.findUnique({
      where: { id: Number(id) },
      include: {
        class: true,
        tests: true,
        _count: { select: { orders: true } },
      },
    });
    if (!bundle) return error("Bundle not found", 404);
    const tests = await hydrateTests(bundle.tests);
    return success({ ...bundle, tests });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    const bundleId = Number(id);
    const body = await parseBody(request, updateSchema);

    const { testIds, ...bundleData } = body;

    if (testIds) {
      const check = await validateTestIds(testIds);
      if (!check.valid) {
        return error(`Invalid testId(s): ${check.missing.join(", ")}`, 422);
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.bundle.update({
        where: { id: bundleId },
        data: bundleData,
      });

      if (testIds) {
        await tx.bundleTest.deleteMany({ where: { bundleId } });
        await tx.bundleTest.createMany({
          data: testIds.map((testId) => ({ bundleId, testId })),
        });
      }
    });

    const updated = await prisma.bundle.findUnique({
      where: { id: bundleId },
      include: { tests: true },
    });

    if (!updated) return error("Bundle not found", 404);
    const tests = await hydrateTests(updated.tests);
    return success({ ...updated, tests });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await requireAuth("admin");
    const { id } = await params;
    await prisma.bundle.update({
      where: { id: Number(id) },
      data: { isActive: false },
    });
    return success({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
