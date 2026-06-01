import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
const p = new PrismaClient();
(async () => {
  console.log("=== Sample question with options ===");
  // Pick a question that has English options
  const q = await p.$queryRaw`
    SELECT q.id, q.text, q.type, q.difficulty, q.subjectId
    FROM vw_questions q
    INNER JOIN vw_question_options o ON o.questionId = q.id
    WHERE q.text IS NOT NULL AND q.text != ''
    GROUP BY q.id, q.text, q.type, q.difficulty, q.subjectId
    HAVING COUNT(o.id) >= 3
    LIMIT 1
  ` as Array<Record<string, unknown>>;
  console.log("Q:", JSON.stringify(q[0], (k, v) => typeof v === "bigint" ? Number(v) : v));

  const qid = (q[0] as { id: number }).id;
  const opts = await p.$queryRawUnsafe(
    `SELECT label, text, isCorrect FROM vw_question_options WHERE questionId = ? ORDER BY sortOrder`,
    qid
  ) as Array<Record<string, unknown>>;
  console.log("\nOptions:");
  for (const o of opts) console.log(`  ${o.label}: ${String(o.text).slice(0, 80)} ${o.isCorrect ? "✓ correct" : ""}`);

  console.log("\n=== Sample test with question count ===");
  const tests = await p.$queryRaw`
    SELECT t.id, t.name, t.classId, t.subjectId, t.durationMinutes, t.isPractice,
           (SELECT COUNT(*) FROM vw_test_questions tq WHERE tq.testId = t.id) as qcount
    FROM vw_tests t
    WHERE t.isActive = TRUE
    ORDER BY qcount DESC
    LIMIT 5
  ` as Array<Record<string, unknown>>;
  for (const t of tests) {
    console.log(`  [${t.id}] ${String(t.name).slice(0, 50)} · class=${t.classId} · subj=${t.subjectId} · ${t.qcount} Qs · ${t.isPractice ? "practice" : "main"}`);
  }

  console.log("\n=== Type distribution ===");
  const types = await p.$queryRaw`SELECT type, COUNT(*) as cnt FROM vw_questions GROUP BY type ORDER BY cnt DESC` as Array<{ type: string; cnt: bigint }>;
  for (const t of types) console.log(`  ${t.type.padEnd(15)} ${Number(t.cnt).toLocaleString()}`);

  console.log("\n=== Class names ===");
  const classes = await p.$queryRaw`SELECT id, name, isActive FROM vw_classes ORDER BY id LIMIT 25` as Array<Record<string, unknown>>;
  for (const c of classes) console.log(`  ${c.id}: ${c.name} ${c.isActive ? "" : "(inactive)"}`);

  await p.$disconnect();
})();
