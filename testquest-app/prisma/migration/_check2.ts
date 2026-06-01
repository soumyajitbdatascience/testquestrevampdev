import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
const p = new PrismaClient();
(async () => {
  const all = await p.$queryRaw`
    SELECT TABLE_NAME FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
    ORDER BY TABLE_NAME
  ` as Array<{ TABLE_NAME: string }>;
  console.log(`All ${all.length} tables in DB:`);
  for (const t of all) console.log(`  ${t.TABLE_NAME}`);
  await p.$disconnect();
})();
