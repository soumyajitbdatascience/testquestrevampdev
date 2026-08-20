/**
 * Seed B2C pass data for development/demo: the three boards and a 3/6/12-month
 * plan row for one class (the class with the most content, so the funnel is
 * demoable end-to-end). Idempotent — upserts by unique keys.
 *
 * Run: npx tsx prisma/migration/seed-b2c.ts [classId]
 */
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  const boards = [
    { name: "CBSE", code: "CBSE", sortOrder: 1 },
    { name: "ICSE", code: "ICSE", sortOrder: 2 },
    { name: "State Board", code: "STATE", sortOrder: 3 },
  ];
  for (const b of boards) {
    await prisma.board.upsert({ where: { code: b.code }, create: b, update: { name: b.name, sortOrder: b.sortOrder } });
  }
  console.log("boards seeded:", boards.map((b) => b.code).join(", "));

  // Pick the demo class: CLI arg, else the legacy class with the most tests
  let classId = Number(process.argv[2]) || 0;
  if (!classId) {
    const rows = await prisma.$queryRawUnsafe<Array<{ classId: number; n: bigint }>>(
      `SELECT classId, COUNT(*) AS n FROM vw_tests WHERE classId IS NOT NULL GROUP BY classId ORDER BY n DESC LIMIT 1`,
    );
    classId = Number(rows[0]?.classId ?? 0);
  }
  if (!classId) throw new Error("No class found to seed plans for");

  const cbse = await prisma.board.findUnique({ where: { code: "CBSE" } });
  const plans = [
    { durationMonths: 3, price: 499 },
    { durationMonths: 6, price: 799 },
    { durationMonths: 12, price: 1299 },
  ];
  for (const p of plans) {
    const existing = await prisma.b2cPlan.findFirst({
      where: { boardId: cbse!.id, classId, subjectId: null, durationMonths: p.durationMonths },
    });
    if (existing) {
      await prisma.b2cPlan.update({ where: { id: existing.id }, data: { price: p.price, isActive: true } });
    } else {
      await prisma.b2cPlan.create({
        data: { boardId: cbse!.id, classId, subjectId: null, durationMonths: p.durationMonths, price: p.price },
      });
    }
  }
  console.log(`plans seeded for CBSE class ${classId}: ₹499/3mo ₹799/6mo ₹1299/12mo`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
