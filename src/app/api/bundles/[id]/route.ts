import { error } from "@/lib/api-utils";

/**
 * Retired: bundles were the per-test/pack commerce model from before the
 * pivot. The purchasable unit is now a Board+Class pass (`tq_class_access`)
 * bought as a 3/6/12-month plan — there is no `tq_bundles` table in this
 * database and nothing should be selling a pack of tests.
 *
 * Kept as an explicit 410 rather than deleted so any client still calling it
 * gets a truthful answer instead of a 404 that reads like a bad id. Removal
 * belongs to a later cleanup pass, together with the `Bundle` / `BundleTest`
 * models still sitting in schema.prisma.
 */
export async function GET() {
  return error("Bundles have been retired — content is sold as a class pass.", 410);
}
