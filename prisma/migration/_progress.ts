import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
const p = new PrismaClient();
(async () => {
  const counts = {
    classes:        await p.class.count(),
    subjects:       await p.subject.count(),
    questions:      await p.question.count({ where: { isLegacy: true } }),
    options:        await p.questionOption.count(),
    questionsByType: await p.question.groupBy({ by: ["type"], where: { isLegacy: true }, _count: true }),
  };
  console.log("DB state right now:");
  for (const [k, v] of Object.entries(counts)) {
    if (Array.isArray(v)) {
      console.log(`  ${k}:`);
      for (const t of v) console.log(`    ${t.type}: ${t._count}`);
    } else console.log(`  ${k}: ${v.toLocaleString()}`);
  }
  await p.$disconnect();
})();
