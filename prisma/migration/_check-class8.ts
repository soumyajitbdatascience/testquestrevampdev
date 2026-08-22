import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
const p = new PrismaClient();
(async () => {
  console.log("=== ALL classes in vw_classes ===");
  const all = await p.$queryRaw`SELECT id, name, isActive FROM vw_classes ORDER BY id` as Array<Record<string, unknown>>;
  for (const c of all) console.log(`  ${c.id}: ${c.name} ${c.isActive ? "" : "(inactive)"}`);

  console.log("\n=== Test count per class (from legacy main_exam) ===");
  const counts = await p.$queryRaw`
    SELECT category_id, COUNT(*) as cnt FROM main_exam GROUP BY category_id ORDER BY cnt DESC LIMIT 15
  ` as Array<{category_id: number; cnt: bigint}>;
  for (const r of counts) {
    const className = await p.$queryRaw`SELECT name FROM vw_classes WHERE id = ${r.category_id} LIMIT 1` as Array<{name: string}>;
    console.log(`  category_id=${r.category_id} ${className[0]?.name || "(unknown — orphan)"} → ${Number(r.cnt)} tests`);
  }

  console.log("\n=== Sample tests under category_id=37 (Class 8 in signup dropdown) ===");
  const cls37 = await p.$queryRaw`SELECT COUNT(*) as cnt FROM main_exam WHERE category_id = 37` as Array<{cnt: bigint}>;
  console.log(`  ${Number(cls37[0].cnt)} tests`);

  await p.$disconnect();
})();
