/**
 * POST /api/coaching/billing/checkout — DISABLED on the decoupled database.
 *
 * This flow stamped tq_orders with itemType=ORG_SUB and reused bundleId as the
 * subscription id. Neither exists in the new schema: tq_orders only models B2C
 * plan purchases, and the coaching/B2B stack (tq_organizations,
 * tq_subscriptions, …) has no tables in this database at all.
 *
 * Kept as an explicit 501 so the route fails with a readable message instead of
 * a "table doesn't exist" 500. It is rebuilt or retired when the coaching phase
 * is revisited.
 */
import { handleApiError, error } from "@/lib/api-utils";

export async function POST() {
  try {
    return error("Coaching billing is not available on this database", 501);
  } catch (err) {
    return handleApiError(err);
  }
}
