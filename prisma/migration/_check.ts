import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
const p = new PrismaClient();
(async () => {
  const r = await p.$queryRaw`SELECT COUNT(*) as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()` as Array<{ cnt: bigint }>;
  console.log(`Total tables: ${Number(r[0].cnt)}`);
  const samples = await p.$queryRaw`
    SELECT TABLE_NAME FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN ('catigories', 'catigories_description', 'subjects', 'question', 'main_exam', 'student')
  ` as Array<{ TABLE_NAME: string }>;
  console.log("Found:", samples.map(s => s.TABLE_NAME).join(", "));
  await p.$disconnect();
})();
