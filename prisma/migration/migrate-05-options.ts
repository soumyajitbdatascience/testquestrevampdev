/**
 * Pivot `question_audio_video_paragraph` (English row) options_1..options_6 into tq_question_options rows.
 *
 * `correct_answer` is position-based like "1,2,,,," — used to set isCorrect.
 * For FILL_IN_BLANK questions, no options created — the option_1 text becomes the question's correctText.
 */
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
import { LANGUAGE_ID_ENGLISH, stripHtml, parseCorrectPositions, positionToLabel } from "./_helpers";

const prisma = new PrismaClient();
const BATCH_SIZE = 1000;

interface LegacyOptionRow {
  question_id: number;
  sub_question_id: number;
  options_1: string | null;
  options_2: string | null;
  options_3: string | null;
  options_4: string | null;
  options_5: string | null;
  options_6: string | null;
  correct_answer: string | null;
  Marks: number | null;
  explanation: string | null;
}

async function main() {
  console.log("=== migrate-05-options ===");

  // Build legacy_question_id → new tq_questions.id map
  const newQs = await prisma.question.findMany({
    where: { legacyId: { not: null } },
    select: { id: true, legacyId: true, type: true },
  });
  const qMap = new Map<number, { id: number; type: string }>();
  for (const q of newQs) if (q.legacyId !== null) qMap.set(q.legacyId, { id: q.id, type: q.type });
  console.log(`Loaded ${qMap.size} migrated questions`);

  // Existing options (for idempotency) — by question
  const existingByQ = new Set(
    (await prisma.questionOption.findMany({ select: { questionId: true } })).map(o => o.questionId)
  );

  // Fetch legacy options for English language only
  console.log("Fetching legacy options…");
  const rows = await prisma.$queryRaw<LegacyOptionRow[]>`
    SELECT
      question_id,
      sub_question_id,
      options_1, options_2, options_3, options_4, options_5, options_6,
      correct_answer,
      Marks,
      explanation
    FROM question_audio_video_paragraph
    WHERE languages_id = ${LANGUAGE_ID_ENGLISH}
    ORDER BY question_id, sub_question_id
  `;
  console.log(`Found ${rows.length} legacy option rows`);

  // For each legacy question, pick the FIRST sub_question_id (since we flatten paragraph)
  const seenQuestion = new Set<number>();
  const fillUpdates: Array<{ questionId: number; correctText: string; explanation: string | null; marks: number }> = [];
  let toInsert: Parameters<typeof prisma.questionOption.createMany>[0]["data"] = [];
  let inserted = 0, skippedAlready = 0, skippedNoQ = 0, skippedFill = 0;
  let questionUpdates = 0;

  for (const r of rows) {
    // Only first sub_question per question (flatten paragraph)
    if (seenQuestion.has(r.question_id)) continue;
    seenQuestion.add(r.question_id);

    const meta = qMap.get(r.question_id);
    if (!meta) { skippedNoQ++; continue; }

    const explanation = stripHtml(r.explanation) || null;
    const marks = r.Marks && r.Marks > 0 ? r.Marks : 1;

    // For fill-in-blank, options_1 is the accepted answer
    if (meta.type === "FILL_IN_BLANK") {
      const correctText = stripHtml(r.options_1);
      if (correctText) {
        fillUpdates.push({ questionId: meta.id, correctText, explanation, marks });
      }
      skippedFill++;
      continue;
    }

    if (existingByQ.has(meta.id)) { skippedAlready++; continue; }

    // Build options list
    const optionTexts = [r.options_1, r.options_2, r.options_3, r.options_4, r.options_5, r.options_6];
    const correctPositions = new Set(parseCorrectPositions(r.correct_answer));

    let optionsCreated = 0;
    for (let i = 0; i < optionTexts.length; i++) {
      const txt = stripHtml(optionTexts[i]);
      if (!txt) continue;
      const pos = i + 1;
      toInsert.push({
        questionId: meta.id,
        label: positionToLabel(pos),
        text: txt,
        isCorrect: correctPositions.has(pos),
      });
      optionsCreated++;
    }
    if (optionsCreated === 0) skippedNoQ++; // count as skip if no usable options

    // Always update question explanation + marks even if no options
    if (explanation || marks > 1) {
      fillUpdates.push({ questionId: meta.id, correctText: "", explanation, marks });
    }

    if (toInsert.length >= BATCH_SIZE) {
      await prisma.questionOption.createMany({ data: toInsert, skipDuplicates: true });
      inserted += toInsert.length;
      process.stdout.write(`  inserted ${inserted}…\r`);
      toInsert = [];
    }
  }
  if (toInsert.length > 0) {
    await prisma.questionOption.createMany({ data: toInsert, skipDuplicates: true });
    inserted += toInsert.length;
  }
  console.log(`\n  inserted ${inserted} option rows`);

  // Apply explanation/correctText/marks updates in batches
  console.log("Updating question explanations & marks…");
  for (const u of fillUpdates) {
    await prisma.question.update({
      where: { id: u.questionId },
      data: {
        explanation: u.explanation || undefined,
        marks: u.marks,
        ...(u.correctText ? { correctText: u.correctText } : {}),
      },
    });
    questionUpdates++;
    if (questionUpdates % 500 === 0) process.stdout.write(`  updated ${questionUpdates}…\r`);
  }

  console.log(`\n✔ options inserted=${inserted}, fill answers=${fillUpdates.filter(u => u.correctText).length}, question updates=${questionUpdates}, skipped (already/no-q)=${skippedAlready + skippedNoQ}`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
