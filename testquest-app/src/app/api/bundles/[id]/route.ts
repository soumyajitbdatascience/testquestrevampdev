import { prisma } from "@/lib/db";
import { handleApiError, success, error } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

// Public (student-readable) bundle detail. Only active bundles are exposed.
// The admin endpoint at /api/admin/bundles/[id] remains admin-only.
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const bundleId = Number(id);
    if (!Number.isFinite(bundleId)) return error("Invalid bundle id", 400);

    const bundle = await prisma.bundle.findUnique({
      where: { id: bundleId },
      include: { tests: true },
    });
    if (!bundle || !bundle.isActive) return error("Bundle not found", 404);

    const testIds = bundle.tests.map((t) => Number(t.testId));
    let tests: Array<{ id: number; name: string }> = [];
    if (testIds.length > 0) {
      const rows = await prisma.$queryRawUnsafe<Array<{ id: number; name: string }>>(
        `SELECT id, name FROM vw_tests WHERE id IN (${testIds.map(() => "?").join(",")})`,
        ...testIds,
      );
      tests = rows.map((r) => ({ id: Number(r.id), name: r.name }));
    }

    return success({
      id: bundle.id,
      name: bundle.name,
      description: bundle.description,
      price: bundle.price,
      validityDays: bundle.validityDays,
      testCount: bundle.tests.length,
      tests,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
