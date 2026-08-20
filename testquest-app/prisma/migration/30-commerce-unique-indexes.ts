/**
 * Additive uniqueness for the money path (Phase 3).
 *
 *   uq_access_order  — one ClassAccess per order
 *   uq_cu_order      — one CouponUsage per (coupon, order)
 *
 * These are belt-and-braces behind the transactional mutex in
 * `grantClassAccess`: the app already guarantees exactly-once, and these make
 * the database refuse a duplicate even if a future code path forgets.
 *
 * Additive only — CREATE UNIQUE INDEX, no column changes, no drops. Refuses to
 * run if existing rows would violate either constraint. Never `prisma db push`.
 */
import "dotenv/config";
import { prisma } from "@/lib/db";

async function indexExists(table: string, name: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COUNT(*) n FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`, table, name);
  return Number(rows[0].n) > 0;
}

async function main() {
  const dupAccess = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COUNT(*) n FROM (SELECT orderId FROM tq_class_access
      WHERE orderId IS NOT NULL GROUP BY orderId HAVING COUNT(*) > 1) x`);
  const dupUsage = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COUNT(*) n FROM (SELECT couponId, orderId FROM tq_coupon_usages
      GROUP BY couponId, orderId HAVING COUNT(*) > 1) x`);

  console.log(`duplicate orderId groups in tq_class_access : ${Number(dupAccess[0].n)}`);
  console.log(`duplicate (couponId,orderId) in tq_coupon_usages: ${Number(dupUsage[0].n)}`);
  if (Number(dupAccess[0].n) > 0 || Number(dupUsage[0].n) > 0) {
    console.log("ABORT — existing rows violate the constraints; clean them first.");
    return;
  }

  if (await indexExists("tq_class_access", "uq_access_order")) {
    console.log("uq_access_order already present");
  } else {
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX uq_access_order ON tq_class_access (orderId)`);
    console.log("created uq_access_order");
  }

  if (await indexExists("tq_coupon_usages", "uq_cu_order")) {
    console.log("uq_cu_order already present");
  } else {
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX uq_cu_order ON tq_coupon_usages (couponId, orderId)`);
    console.log("created uq_cu_order");
  }
}

main().catch((e) => { console.error("FAILED:", e); process.exitCode = 1; })
      .finally(() => prisma.$disconnect());
