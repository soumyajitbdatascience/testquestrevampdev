import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
const p = new PrismaClient();
(async () => {
  const dist = await p.$queryRaw`SELECT status, COUNT(*) as cnt FROM main_exam_status GROUP BY status` as Array<{status:number;cnt:bigint}>;
  console.log("main_exam_status.status:", dist.map(r => ({s: r.status, cnt: Number(r.cnt)})));

  const pdist = await p.$queryRaw`SELECT status, COUNT(*) as cnt FROM practice_exam_status GROUP BY status` as Array<{status:number;cnt:bigint}>;
  console.log("practice_exam_status.status:", pdist.map(r => ({s: r.status, cnt: Number(r.cnt)})));

  console.log("\nSample main_exam_to_question.correct_answer values:");
  const ca = await p.$queryRaw`
    SELECT correct_answer, COUNT(*) as cnt FROM main_exam_to_question
    GROUP BY correct_answer ORDER BY cnt DESC LIMIT 10
  ` as Array<{correct_answer:string;cnt:bigint}>;
  for (const r of ca) console.log(`  "${r.correct_answer}" → ${Number(r.cnt)}`);

  console.log("\nSample main_exam_result rows:");
  const rs = await p.$queryRaw`SELECT * FROM main_exam_result ORDER BY exam_result_id DESC LIMIT 2`;
  console.log(JSON.stringify(rs, (k,v) => typeof v === "bigint" ? Number(v) : v, 2).slice(0, 1000));

  await p.$disconnect();
})();
