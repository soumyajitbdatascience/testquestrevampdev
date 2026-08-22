import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
const p = new PrismaClient();
(async () => {
  // Sample orphan subjects (no subcategory link)
  console.log("=== Orphan subjects (no subcategories row) ===");
  const orphans = await p.$queryRaw`
    SELECT s.subjects_id, s.Temp_Subject_Name, s.catg_name, s.course_name, s.chapter_name, sd.subject_name
    FROM subjects s
    LEFT JOIN subcategories sc ON sc.subjects_id = s.subjects_id
    LEFT JOIN subjects_description sd ON sd.subjects_id = s.subjects_id AND sd.languages_id = 3
    WHERE sc.subjects_id IS NULL
    LIMIT 8
  `;
  console.log(JSON.stringify(orphans, null, 2));

  console.log("\n=== Subject 314 (646 questions) — full row ===");
  const s314 = await p.$queryRaw`SELECT * FROM subjects WHERE subjects_id = 314`;
  console.log(JSON.stringify(s314, null, 2));
  const sd314 = await p.$queryRaw`SELECT * FROM subjects_description WHERE subjects_id = 314 AND languages_id = 3`;
  console.log("description:", JSON.stringify(sd314, null, 2));

  console.log("\n=== Does subject 314 appear in any main_exam? ===");
  const exams = await p.$queryRaw`
    SELECT exam_id, category_id, subject_id FROM main_exam
    WHERE FIND_IN_SET('314', subject_id) > 0
    LIMIT 5
  `;
  console.log(JSON.stringify(exams, null, 2));

  console.log("\n=== subjects.catg_name distribution ===");
  const catgNames = await p.$queryRaw`
    SELECT catg_name, COUNT(*) as cnt FROM subjects GROUP BY catg_name ORDER BY cnt DESC LIMIT 15
  `;
  console.log(JSON.stringify(catgNames, (k, v) => typeof v === "bigint" ? Number(v) : v, 2));

  await p.$disconnect();
})();
