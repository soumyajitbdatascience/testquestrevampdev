import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, success } from "@/lib/api-utils";

/**
 * A student's purchase history.
 *
 * Every order references a class pass (`tq_b2c_plans`); per-test and bundle
 * purchases were retired with the old schema. The `access` block used to list
 * grandfathered per-test purchases from `tq_student_access` — a table that
 * does not exist in this database, and students here start at zero, so there
 * is nothing to grandfather. The keys stay in the response so existing
 * consumers keep their shape; they are simply always empty.
 */
export async function GET() {
  try {
    const session = await requireAuth("student");

    const orders = await prisma.order.findMany({
      where: { studentId: session.id },
      orderBy: { createdAt: "desc" },
    });

    return success({
      orders: orders.map((o) => ({ ...o, test: null })),
      access: { active: [], expired: [] },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
