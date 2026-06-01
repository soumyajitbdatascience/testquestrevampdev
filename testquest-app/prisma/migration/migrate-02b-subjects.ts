/**
 * Enhanced subject migration — derives class from multiple signals.
 *
 * Signal priority for each legacy subject:
 *   1) subcategories.categories_id (direct join — covers ~40 subjects)
 *   2) Most-frequent main_exam.category_id where this subject is used
 *   3) Parse "Class N" prefix from subject_name (e.g. "Class 8 - Physics …")
 *   4) Fallback to an "Uncategorized" class for orphans
 *
 * For subjects_id = 0 (questions with no subject reference), creates a special
 * "Unassigned" subject under the Uncategorized class.
 *
 * Wipes tq_subjects first since the previous run was insufficient. tq_questions
 * is already empty so no FK damage.
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "../../src/generated/prisma/client";
import { LANGUAGE_ID_ENGLISH, stripHtml } from "./_helpers";

const prisma = new PrismaClient();

interface LegacySubject {
  subjects_id: number;
  subjects_status: number;
  subject_name: string | null;
  catg_name: string | null;
  course_name: string | null;
  chapter_name: string | null;
}

async function main() {
  console.log("=== migrate-02b-subjects (enhanced) ===");

  // Wipe previous attempt
  await prisma.subject.deleteMany();
  console.log("Wiped tq_subjects (questions table is empty so no FKs broken)");

  // Class legacy_id → new id
  const classes = await prisma.class.findMany({ where: { legacyId: { not: null } } });
  const classMap = new Map<number, number>();
  for (const c of classes) if (c.legacyId !== null) classMap.set(c.legacyId, c.id);

  // Ensure a fallback "Uncategorized" class exists
  let fallbackClass = await prisma.class.findFirst({ where: { name: "Uncategorized" } });
  if (!fallbackClass) {
    fallbackClass = await prisma.class.create({
      data: { name: "Uncategorized", sortOrder: 9999, isActive: false },
    });
    console.log(`Created fallback class: Uncategorized (id=${fallbackClass.id})`);
  }

  // Signal 1: subcategories direct map
  const subCatRows = await prisma.$queryRaw<Array<{ subjects_id: number; categories_id: number }>>`
    SELECT subjects_id, categories_id FROM subcategories WHERE categories_id IS NOT NULL
  `;
  const directClassByLegacySubject = new Map<number, number[]>();
  for (const r of subCatRows) {
    const arr = directClassByLegacySubject.get(r.subjects_id) || [];
    arr.push(r.categories_id);
    directClassByLegacySubject.set(r.subjects_id, arr);
  }

  // Signal 2: main_exam usage — most common category_id per subject
  console.log("Building exam-usage signal…");
  const examRows = await prisma.$queryRaw<Array<{ exam_id: number; category_id: number; subject_id: string }>>`
    SELECT exam_id, category_id, subject_id FROM main_exam WHERE subject_id IS NOT NULL AND subject_id != ''
  `;
  const examClassBySubject = new Map<number, Map<number, number>>(); // subjId → catId → count
  for (const er of examRows) {
    const ids = String(er.subject_id).split(",").map(s => Number(s.trim())).filter(Boolean);
    for (const sid of ids) {
      let cm = examClassBySubject.get(sid);
      if (!cm) { cm = new Map(); examClassBySubject.set(sid, cm); }
      cm.set(er.category_id, (cm.get(er.category_id) || 0) + 1);
    }
  }
  function topClassFromExams(sid: number): number | undefined {
    const m = examClassBySubject.get(sid);
    if (!m) return;
    let best: [number, number] | null = null;
    for (const [cat, n] of m) if (!best || n > best[1]) best = [cat, n];
    return best?.[0];
  }

  // Signal 3: parse class number from subject name
  function parseClassFromName(name: string): number | null {
    const m = name.match(/Class\s*(\d{1,2})/i);
    if (!m) return null;
    const n = Number(m[1]);
    if (n < 1 || n > 12) return null;
    // Find class whose name contains the number
    for (const c of classes) {
      if (c.name.includes(String(n))) return c.legacyId;
    }
    return null;
  }

  // Fetch all subjects with English name
  const legacy = await prisma.$queryRaw<LegacySubject[]>`
    SELECT
      s.subjects_id, s.subjects_status,
      sd.subject_name,
      s.catg_name, s.course_name, s.chapter_name
    FROM subjects s
    LEFT JOIN subjects_description sd
      ON sd.subjects_id = s.subjects_id AND sd.languages_id = ${LANGUAGE_ID_ENGLISH}
    ORDER BY s.subjects_id
  `;
  console.log(`Found ${legacy.length} legacy subjects`);

  // For each subject, decide class
  type CanonKey = string;
  const groups = new Map<CanonKey, { newClassId: number; name: string; legacyIds: number[]; anyActive: boolean }>();
  const legacyToNew = new Map<number, number>(); // populated after upserts

  let viaSubcat = 0, viaExam = 0, viaName = 0, viaFallback = 0;

  for (const s of legacy) {
    const name = stripHtml(s.subject_name);
    if (!name) continue;

    let legacyCategoryId: number | null = null;
    const direct = directClassByLegacySubject.get(s.subjects_id);
    if (direct && direct.length > 0) {
      legacyCategoryId = direct[0];
      viaSubcat++;
    }
    if (!legacyCategoryId) {
      const fromExam = topClassFromExams(s.subjects_id);
      if (fromExam) { legacyCategoryId = fromExam; viaExam++; }
    }
    if (!legacyCategoryId) {
      const fromName = parseClassFromName(name);
      if (fromName) { legacyCategoryId = fromName; viaName++; }
    }

    let newClassId: number;
    if (legacyCategoryId && classMap.has(legacyCategoryId)) {
      newClassId = classMap.get(legacyCategoryId)!;
    } else {
      newClassId = fallbackClass.id;
      viaFallback++;
    }

    const k = `${newClassId}|${name.toLowerCase()}`;
    const existing = groups.get(k);
    if (existing) {
      existing.legacyIds.push(s.subjects_id);
      existing.anyActive = existing.anyActive || s.subjects_status === 1;
    } else {
      groups.set(k, { newClassId, name, legacyIds: [s.subjects_id], anyActive: s.subjects_status === 1 });
    }
  }

  console.log(`Signals: subcategories=${viaSubcat}, exam-usage=${viaExam}, name-parsed=${viaName}, fallback=${viaFallback}`);
  console.log(`Unique canonical subjects: ${groups.size}`);

  // Upsert subjects
  let created = 0;
  for (const g of groups.values()) {
    const traceLegacyId = g.legacyIds[0];
    const subj = await prisma.subject.upsert({
      where: { legacyId: traceLegacyId },
      create: { legacyId: traceLegacyId, classId: g.newClassId, name: g.name, isActive: g.anyActive, sortOrder: 0 },
      update: { name: g.name, classId: g.newClassId, isActive: g.anyActive },
    });
    for (const lid of g.legacyIds) legacyToNew.set(lid, subj.id);
    created++;
  }

  // Create a special "Unassigned" subject under the fallback class for subjects_id=0 questions
  const unassigned = await prisma.subject.upsert({
    where: { legacyId: 0 },
    create: { legacyId: 0, classId: fallbackClass.id, name: "Unassigned", isActive: false, sortOrder: 0 },
    update: {},
  });
  legacyToNew.set(0, unassigned.id);
  console.log(`Created "Unassigned" subject (id=${unassigned.id}) under Uncategorized class`);

  // Persist enriched map
  const mapPath = path.join(__dirname, "_subject-map.json");
  fs.writeFileSync(mapPath, JSON.stringify(Object.fromEntries(legacyToNew), null, 0));

  // Coverage check
  const questions = await prisma.$queryRaw<Array<{ cnt: bigint }>>`SELECT COUNT(*) as cnt FROM question`;
  const totalQ = Number(questions[0].cnt);
  const mappedQ = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
    `SELECT COUNT(*) as cnt FROM question WHERE subjects_id IN (${[...legacyToNew.keys()].join(",")})`
  );
  const mappedCount = Number(mappedQ[0].cnt);
  console.log(`\n✔ created=${created} canonical subjects + 1 Unassigned`);
  console.log(`✔ Question coverage: ${mappedCount.toLocaleString()} / ${totalQ.toLocaleString()} (${((mappedCount / totalQ) * 100).toFixed(1)}%)`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
