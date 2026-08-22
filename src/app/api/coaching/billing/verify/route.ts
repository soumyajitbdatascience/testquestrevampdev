/**
 * POST /api/coaching/billing/verify — DISABLED on the decoupled database.
 *
 * The counterpart to /api/coaching/billing/checkout: it verified an ORG_SUB
 * order and activated a tq_subscriptions row. Neither the order type nor the
 * subscription tables exist in the new schema.
 *
 * Kept as an explicit 501 so the route fails with a readable message instead of
 * a "table doesn't exist" 500.
 */
import { handleApiError, error } from "@/lib/api-utils";

export async function POST() {
  try {
    return error("Coaching billing is not available on this database", 501);
  } catch (err) {
    return handleApiError(err);
  }
}
