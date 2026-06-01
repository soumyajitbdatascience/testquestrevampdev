import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
const p = new PrismaClient();
(async () => {
  console.log("=== sub_question_id distribution in question_audio_video_paragraph (English) ===");
  const sqDist = await p.$queryRaw`
    SELECT sub_question_id, COUNT(*) as cnt
    FROM question_audio_video_paragraph
    WHERE languages_id = 3
    GROUP BY sub_question_id
    ORDER BY cnt DESC
    LIMIT 10
  ` as Array<{ sub_question_id: number; cnt: bigint }>;
  console.log(sqDist.map(r => ({ sub: r.sub_question_id, cnt: Number(r.cnt) })));

  console.log("\n=== Sample row (latest) ===");
  const latest = await p.$queryRaw`
    SELECT id, question_id, sub_question_id, languages_id, options_1, options_2, options_3, options_4, correct_answer
    FROM question_audio_video_paragraph
    WHERE languages_id = 3
    ORDER BY id DESC LIMIT 3
  ` as Array<Record<string, unknown>>;
  for (const r of latest) {
    console.log(JSON.stringify(r, (k, v) => typeof v === "bigint" ? Number(v) : v).slice(0, 250));
  }

  console.log("\n=== Per-question count of qavp rows (English) ===");
  const perQ = await p.$queryRaw`
    SELECT question_id, COUNT(*) as cnt
    FROM question_audio_video_paragraph
    WHERE languages_id = 3
    GROUP BY question_id
    HAVING cnt > 1
    LIMIT 5
  ` as Array<{ question_id: number; cnt: bigint }>;
  console.log("Questions with multiple English rows:", perQ.map(r => ({ qid: r.question_id, cnt: Number(r.cnt) })));

  await p.$disconnect();
})();
