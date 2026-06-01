/** Migrate legacy `catigories` + `catigories_description` → tq_classes */
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
import { LANGUAGE_ID_ENGLISH, stripHtml } from "./_helpers";

const prisma = new PrismaClient();

async function main() {
  console.log("=== migrate-01-classes ===");

  const rows = await prisma.$queryRaw<Array<{
    categories_id: number;
    categories_status: number;
    name: string | null;
  }>>`
    SELECT c.categories_id, c.categories_status, cd.categories_name as name
    FROM catigories c
    LEFT JOIN catigories_description cd
      ON cd.categories_id = c.categories_id AND cd.languages_id = ${LANGUAGE_ID_ENGLISH}
    ORDER BY c.categories_id
  `;

  console.log(`Found ${rows.length} legacy classes`);

  let created = 0, updated = 0, skipped = 0;
  for (const row of rows) {
    const name = stripHtml(row.name);
    if (!name) { skipped++; continue; }

    const existing = await prisma.class.findUnique({ where: { legacyId: row.categories_id } });
    await prisma.class.upsert({
      where: { legacyId: row.categories_id },
      create: {
        legacyId: row.categories_id,
        name,
        isActive: row.categories_status === 1,
        sortOrder: row.categories_id,
      },
      update: {
        name,
        isActive: row.categories_status === 1,
      },
    });
    if (existing) updated++; else created++;
  }

  console.log(`✔ created=${created}, updated=${updated}, skipped=${skipped}`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
