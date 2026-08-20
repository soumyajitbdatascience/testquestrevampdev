import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success } from "@/lib/api-utils";
import { planRowSchema, writeRowsPricing } from "@/lib/admin-pricing";

/**
 * Bulk pricing — "copy this row to every class" and the Undo that reverses it.
 *
 * The same payload shape serves both directions: an undo is just the previous
 * prices sent back, with `null` for terms that were inactive before. One
 * request, one transaction, one count to show in the toast.
 *
 * Capped at 200 rows: the whole grid is boards × classes (~30 today), so
 * anything larger is a malformed client, not a legitimate bulk edit.
 */
const bulkSchema = z
  .object({ rows: z.array(planRowSchema).min(1).max(200) })
  .strict();

export async function POST(request: Request) {
  try {
    await requireAuth("admin");
    const { rows } = await parseBody(request, bulkSchema);

    const applied = await writeRowsPricing(rows);
    return success({ applied });
  } catch (err) {
    return handleApiError(err);
  }
}
