import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "../../src/generated/prisma/client";
const p = new PrismaClient();
(async () => {
  const map = JSON.parse(fs.readFileSync(path.join(__dirname, "_subject-map.json"), "utf-8")) as Record<string, number>;
  const mappedLegacyIds = Object.keys(map).map(Number);
  console.log(`Mapped subject legacyIds: ${mappedLegacyIds.length}`);

  // Total questions
  const total = await p.$queryRaw`SELECT COUNT(*) as cnt FROM question` as Array<{ cnt: bigint }>;
  console.log(`Total questions in legacy: ${Number(total[0].cnt).toLocaleString()}`);

  // Questions whose subjects_id is in our map
  const placeholders = mappedLegacyIds.map(() => "?").join(",");
  const mapped = await p.$queryRawUnsafe(
    `SELECT COUNT(*) as cnt FROM question WHERE subjects_id IN (${placeholders})`,
    ...mappedLegacyIds
  ) as Array<{ cnt: bigint }>;
  console.log(`Questions with mapped subject: ${Number(mapped[0].cnt).toLocaleString()}`);

  // Top 10 subjects by question count
  console.log("\nTop subjects by question count (legacy IDs):");
  const top = await p.$queryRaw`
    SELECT subjects_id, COUNT(*) as cnt FROM question GROUP BY subjects_id ORDER BY cnt DESC LIMIT 15
  ` as Array<{ subjects_id: number; cnt: bigint }>;
  for (const r of top) {
    const inMap = mappedLegacyIds.includes(r.subjects_id) ? "✓ mapped" : "✗ NOT mapped";
    console.log(`  subjects_id=${r.subjects_id} → ${Number(r.cnt).toLocaleString()} questions  ${inMap}`);
  }

  await p.$disconnect();
})();
