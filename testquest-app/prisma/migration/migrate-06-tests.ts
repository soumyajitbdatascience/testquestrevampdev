/**
 * Migrate legacy `main_exam` (+ `practice_exam`) → tq_tests.
 *
 * Skips descriptive_main_exam for now (just 2 rows, all subjective questions).
 */
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
import { LANGUAGE_ID_ENGLISH, stripHtml } from "./_helpers";

const prisma = new PrismaClient();

interface LegacyMainExam {
  exam_id: number;
  category_id: number;
  subject_id: string | null;
  exam_duration: number;
  re_exam_day: number | null;
  exam_status: number;
  exam_price: string | number | null;
  sale_exam_without_packages_status: number | null;
  exam_name: string | null;
  terms_condition: string | null;
}

async function main() {
  console.log("=== migrate-06-tests ===");

  // Class legacy_id → new id
  const classes = await prisma.class.findMany({ where: { legacyId: { not: null } } });
  const classMap = new Map<number, number>();
  for (const c of classes) if (c.legacyId !== null) classMap.set(c.legacyId, c.id);

  // Subject map from migrate-02 (load from JSON)
  const subjectMap = await loadSubjectMap();

  let total = { created: 0, updated: 0, skipped: 0 };

  total = await migrateBucket(prisma, "main_exam", "main_exam_description", false, classMap, subjectMap, total);
  total = await migrateBucket(prisma, "practice_exam", "practice_exam_description", true, classMap, subjectMap, total);

  console.log(`\n✔ total created=${total.created}, updated=${total.updated}, skipped=${total.skipped}`);
}

async function loadSubjectMap(): Promise<Record<string, number>> {
  const fs = await import("fs");
  const path = await import("path");
  const p = path.join(__dirname, "_subject-map.json");
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

async function migrateBucket(
  prisma: PrismaClient,
  examTable: string,
  descTable: string,
  isPractice: boolean,
  classMap: Map<number, number>,
  subjectMap: Record<string, number>,
  total: { created: number; updated: number; skipped: number }
) {
  console.log(`\n  → ${examTable} (${isPractice ? "practice" : "main"})`);

  const rows = await prisma.$queryRawUnsafe<LegacyMainExam[]>(`
    SELECT
      e.exam_id,
      e.category_id,
      e.subject_id,
      e.exam_duration,
      e.re_exam_day,
      e.exam_status,
      e.exam_price,
      e.sale_exam_without_packages_status,
      d.exam_name,
      d.terms_condition
    FROM \`${examTable}\` e
    LEFT JOIN \`${descTable}\` d
      ON d.exam_id = e.exam_id AND d.languages_id = ${LANGUAGE_ID_ENGLISH}
    ORDER BY e.exam_id
  `);

  console.log(`    Found ${rows.length} legacy ${examTable} rows`);

  for (const r of rows) {
    const name = stripHtml(r.exam_name);
    const description = stripHtml(r.terms_condition) || null;
    if (!name) { total.skipped++; continue; }

    const newClassId = classMap.get(r.category_id);
    if (!newClassId) { total.skipped++; continue; }

    // subject_id is sometimes "25,24,31" — take first
    const firstSubjId = Number(String(r.subject_id || "").split(",")[0]?.trim());
    const newSubjectId = firstSubjId ? subjectMap[String(firstSubjId)] : undefined;
    if (!newSubjectId) { total.skipped++; continue; }

    const price = Number(r.exam_price || 0);
    const isFree = price === 0;

    // Suffix legacy table when both bucket types share an exam_id space
    const legacyId = isPractice ? r.exam_id + 1_000_000 : r.exam_id;

    const existing = await prisma.test.findUnique({ where: { legacyId } });
    await prisma.test.upsert({
      where: { legacyId },
      create: {
        legacyId,
        classId: newClassId,
        subjectId: newSubjectId,
        name,
        description,
        durationMinutes: Math.max(1, r.exam_duration || 30),
        totalMarks: 0, // computed in test-questions step
        isFree,
        price,
        isPractice,
        randomizeQuestions: true,
        randomizeOptions: true,
        retakeCooldownDays: r.re_exam_day || 0,
        isActive: r.exam_status === 1,
        isLegacy: true,
      },
      update: {
        name,
        description,
        durationMinutes: Math.max(1, r.exam_duration || 30),
        isFree,
        price,
        retakeCooldownDays: r.re_exam_day || 0,
        isActive: r.exam_status === 1,
      },
    });
    if (existing) total.updated++; else total.created++;
  }
  return total;
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
