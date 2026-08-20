/**
 * Writes for the Plans & pricing grid.
 *
 * One place decides what "saving a price" means, so the single-row Save and the
 * bulk actions (fill across durations, copy a row to every class) cannot drift
 * into different semantics. The rules:
 *
 * - A positive price **activates** that term. Pricing something and leaving it
 *   inactive is the "why is my offering still red?" trap, so the write path
 *   never produces that state.
 * - Zero or empty **deactivates** rather than deletes — the row keeps its price
 *   as history, and Launch Readiness stops counting it as sellable.
 * - Prices are whole units of whatever `tq_b2c_plans.price` already stores; the
 *   schema below rejects fractions and negatives before anything is written.
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { PLAN_DURATIONS } from "@/lib/pricing";

/** The three terms a class pass is sold in. `.strict()` rejects a stray "9". */
export const planPricesSchema = z
  .object({
    "3": z.number().int().nonnegative().nullable(),
    "6": z.number().int().nonnegative().nullable(),
    "12": z.number().int().nonnegative().nullable(),
  })
  .strict();

export const planRowSchema = z
  .object({
    boardId: z.number().int().positive(),
    classId: z.number().int().positive(),
    prices: planPricesSchema,
  })
  .strict();

export type PlanRowInput = z.infer<typeof planRowSchema>;

const scopeKey = (boardId: number, classId: number) => `${boardId}:${classId}`;

/**
 * Applies pricing for one or more board+class rows.
 *
 * Existing plans are read in a single query and the writes go out as one
 * transaction: a 30-row bulk apply is 90 cells, and a read-then-write per cell
 * would be 180 sequential round trips against the shared host. Batching also
 * makes a bulk action all-or-nothing, so an Undo has something coherent to
 * revert to.
 *
 * Returns the number of rows applied — the count the confirm and undo toast show.
 */
export async function writeRowsPricing(rows: PlanRowInput[]): Promise<number> {
  // A repeated scope in one payload would issue two writes for the same cell;
  // last one wins, matching what the grid shows.
  const deduped = [...new Map(rows.map((r) => [scopeKey(r.boardId, r.classId), r])).values()];
  if (deduped.length === 0) return 0;

  const existing = await prisma.b2cPlan.findMany({
    where: {
      subjectId: null,
      OR: deduped.map((r) => ({ boardId: r.boardId, classId: r.classId })),
    },
    select: { id: true, boardId: true, classId: true, durationMonths: true },
  });
  const idByCell = new Map(
    existing.map((p) => [`${scopeKey(p.boardId, p.classId)}:${p.durationMonths}`, p.id]),
  );

  const ops = [];
  for (const row of deduped) {
    for (const duration of PLAN_DURATIONS) {
      const price = row.prices[String(duration) as "3" | "6" | "12"];
      const id = idByCell.get(`${scopeKey(row.boardId, row.classId)}:${duration}`);

      if (price == null || price <= 0) {
        if (id != null) ops.push(prisma.b2cPlan.update({ where: { id }, data: { isActive: false } }));
        continue;
      }
      if (id != null) {
        ops.push(prisma.b2cPlan.update({ where: { id }, data: { price, isActive: true } }));
      } else {
        ops.push(
          prisma.b2cPlan.create({
            data: {
              boardId: row.boardId,
              classId: row.classId,
              subjectId: null,
              durationMonths: duration,
              price,
            },
          }),
        );
      }
    }
  }

  if (ops.length > 0) await prisma.$transaction(ops);
  return deduped.length;
}
