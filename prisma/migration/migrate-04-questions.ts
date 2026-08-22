/**
 * Migrate legacy `question` + `question_description` (English) → tq_questions.
 *
 * Does NOT migrate options yet — that's step 5.
 *
 * Uses createMany / bulk operations for speed against the remote Hostinger DB.
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "../../src/generated/prisma/client";
import { LANGUAGE_ID_ENGLISH, stripHtml, mapQuestionType, mapDifficulty } from "./_helpers";

const prisma = new PrismaClient();
const BATCH_SIZE = 500;

interface LegacyQuestion {
  question_id: number;
  subjects_id: number;
  difficulty_level: number | null;
  answer_type: number;
  question_type: number;
  question_status: number;
  main_question: string | null;
}

async function main() {
  console.log("=== migrate-04-questions ===");

  // Load subject map
  const mapPath = path.join(__dirname, "_subject-map.json");
  if (!fs.existsSync(mapPath)) throw new Error("Run migrate-02-subjects first");
  const subjectMap: Record<string, number> = JSON.parse(fs.readFileSync(mapPath, "utf-8"));

  // Fetch existing legacy IDs to avoid re-creating
  const existing = await prisma.question.findMany({
    where: { legacyId: { not: null } },
    select: { legacyId: true },
  });
  const existingIds = new Set(existing.map(e => e.legacyId));
  console.log(`Already migrated: ${existingIds.size}`);

  // Fetch all legacy questions joined with English description
  console.log("Fetching legacy questions…");
  const legacy = await prisma.$queryRaw<LegacyQuestion[]>`
    SELECT
      q.question_id,
      q.subjects_id,
      q.difficulty_level,
      q.answer_type,
      q.question_type,
      q.question_status,
      qd.main_question
    FROM question q
    INNER JOIN question_description qd
      ON qd.question_id = q.question_id AND qd.languages_id = ${LANGUAGE_ID_ENGLISH}
    ORDER BY q.question_id
  `;
  console.log(`Found ${legacy.length} legacy questions with English description`);

  let toInsert: Parameters<typeof prisma.question.createMany>[0]["data"] = [];
  let skippedNoSubject = 0, skippedNoText = 0, skippedAlready = 0, inserted = 0;

  for (const q of legacy) {
    if (existingIds.has(q.question_id)) { skippedAlready++; continue; }

    const text = stripHtml(q.main_question);
    if (!text) { skippedNoText++; continue; }

    const newSubjectId = subjectMap[String(q.subjects_id)];
    if (!newSubjectId) { skippedNoSubject++; continue; }

    toInsert.push({
      legacyId: q.question_id,
      subjectId: newSubjectId,
      chapterId: null,
      type: mapQuestionType(q.answer_type, q.question_type),
      difficulty: mapDifficulty(q.difficulty_level),
      text,
      marks: 1, // will be enriched in step 7 from main_exam_to_question if needed
      isLegacy: true,
      isActive: q.question_status === 1,
    });

    if (toInsert.length >= BATCH_SIZE) {
      await prisma.question.createMany({ data: toInsert, skipDuplicates: true });
      inserted += toInsert.length;
      process.stdout.write(`  inserted ${inserted}…\r`);
      toInsert = [];
    }
  }
  if (toInsert.length > 0) {
    await prisma.question.createMany({ data: toInsert, skipDuplicates: true });
    inserted += toInsert.length;
  }

  console.log(`\n✔ inserted=${inserted}, already-present=${skippedAlready}, no-text=${skippedNoText}, no-subject=${skippedNoSubject}`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
