import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
const p = new PrismaClient();
(async () => {
  const all = await p.$queryRaw`
    SELECT classId, COUNT(*) as total,
      SUM(CASE WHEN isFree THEN 1 ELSE 0 END) as freeCnt,
      SUM(CASE WHEN isActive THEN 1 ELSE 0 END) as activeCnt
    FROM vw_tests
    GROUP BY classId ORDER BY total DESC LIMIT 10
  ` as Array<{classId: number; total: bigint; freeCnt: bigint; activeCnt: bigint}>;
  console.log("classId | total | free | active");
  for (const r of all) {
    console.log(`  ${r.classId} | ${Number(r.total)} | ${Number(r.freeCnt)} | ${Number(r.activeCnt)}`);
  }

  console.log("\nFree+Active per class:");
  const fa = await p.$queryRaw`
    SELECT classId, COUNT(*) as cnt FROM vw_tests
    WHERE isFree = 1 AND isActive = 1 GROUP BY classId ORDER BY cnt DESC LIMIT 10
  ` as Array<{classId:number;cnt:bigint}>;
  for (const r of fa) console.log(`  classId=${r.classId} → ${Number(r.cnt)} free+active`);

  console.log("\nClass 10 (id=45) sample with price + isFree + isActive:");
  const sample = await p.$queryRaw`
    SELECT id, name, price, isFree, isActive FROM vw_tests WHERE classId = 45 LIMIT 10
  ` as Array<Record<string, unknown>>;
  for (const s of sample) console.log(`  id=${s.id} price=${s.price} free=${s.isFree} active=${s.isActive} | ${String(s.name).slice(0, 50)}`);

  await p.$disconnect();
})();
