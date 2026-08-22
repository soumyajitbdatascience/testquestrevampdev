import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, success } from "@/lib/api-utils";
import { paiseToRupees } from "@/lib/money";

/**
 * A student's purchase history.
 *
 * Every order references a class pass (`tq_b2c_plans`); per-test and bundle
 * purchases were retired with the old schema. The `access` block used to list
 * grandfathered per-test purchases from `tq_student_access` — a table that
 * does not exist in this database, and students here start at zero, so there
 * is nothing to grandfather. The keys stay in the response so existing
 * consumers keep their shape; they are simply always empty.
 *
 * MONEY: orders store paise. The amounts leave here in **rupees**, matching
 * `/api/student/subscriptions` — in this codebase the API divides once and the
 * page prints `₹{value}` verbatim. Returning them raw is what made the profile
 * read "₹100000" for a ₹1,000 pass. The stored values and the Razorpay path
 * still carry paise and are untouched; this is display only, and it must not
 * be divided again at the edge.
 */
export async function GET() {
  try {
    const session = await requireAuth("student");

    const orders = await prisma.order.findMany({
      where: { studentId: session.id },
      orderBy: { createdAt: "desc" },
    });

    return success({
      orders: orders.map((o) => ({
        ...o,
        amount: paiseToRupees(Number(o.amount)),
        discount: paiseToRupees(Number(o.discount)),
        finalAmount: paiseToRupees(Number(o.finalAmount)),
        test: null,
      })),
      access: { active: [], expired: [] },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
