/**
 * Money units — the one place rupees become paise and back.
 *
 * The system is deliberately mixed, so read this before touching an amount:
 *
 *   · `tq_b2c_plans.price` is **rupees** — that is what the admin grid types
 *     and what the paywall shows. Do not change it.
 *   · `tq_orders.amount / discount / finalAmount` are **paise** — integers, no
 *     fractions, and exactly what Razorpay is handed.
 *
 * The ×100 happens **once**, here, when a plan's rupee price is quoted into an
 * order. Nothing downstream multiplies again: the Razorpay call passes
 * `finalAmount` straight through. Every display path divides once, via
 * `paiseToRupees`. A second multiplication anywhere is a 100× billing bug, so
 * amounts never travel as bare numbers of ambiguous unit — the helpers are the
 * only legitimate conversion.
 */

/** Rupees (as stored on a plan) → paise (as stored on an order and charged). */
export function rupeesToPaise(rupees: number): number {
  if (!Number.isFinite(rupees) || rupees < 0) return 0;
  // Round rather than truncate: 499.999 from a percentage discount is 50000
  // paise, not 49999. Plans are whole rupees, so this only bites on discounts.
  return Math.round(rupees * 100);
}

/** Paise → rupees, for display and for anything a human reads. */
export function paiseToRupees(paise: number): number {
  if (!Number.isFinite(paise)) return 0;
  return paise / 100;
}

/** "₹1,000" from paise — receipts, history, admin revenue. */
export function formatPaise(paise: number): string {
  return `₹${paiseToRupees(paise).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Adds whole months without the JS month-end trap.
 *
 * `new Date(2026, 10, 30).setMonth(+3)` lands on **2 March**, because 30
 * February does not exist and JS rolls it forward. A student buying a 3-month
 * pass on 30 November must expire on 28 February, not gain two days — and on a
 * 31st, not lose three. So the day is clamped to the target month's length.
 */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDayOfTarget = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDayOfTarget));
  return d;
}
