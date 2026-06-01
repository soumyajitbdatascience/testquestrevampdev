/**
 * Migrate legacy subjects → tq_subjects.
 *
 * Strategy: Each legacy subject row has a class via `subcategories.categories_id`.
 * One legacy subject can appear in multiple subcategory rows under multiple classes.
 * For each (class_id, English subject_name), we create ONE canonical tq_subject.
 *
 * We store the legacy subjects_id of the FIRST occurrence on Subject.legacyId for trace.
 * Saves a JSON map `{ legacy_subjects_id: new_subject_id }` to disk for downstream scripts.
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "../../src/generated/prisma/client";
import { LANGUAGE_ID_ENGLISH, stripHtml } from "./_helpers";

const prisma = new PrismaClient();

interface LegacyRow {
  subjects_id: number;
  subjects_status: number;
  subject_name: string | null;
  categories_id: number | null;
}

async function main() {
  console.log("=== migrate-02-subjects ===");

  // Get every subject linked to a category via subcategories (one row per linkage)
  const rows = await prisma.$queryRaw<LegacyRow[]>`
    SELECT
      s.subjects_id,
      s.subjects_status,
      sd.subject_name,
      sc.categories_id
    FROM subjects s
    LEFT JOIN subjects_description sd
      ON sd.subjects_id = s.subjects_id AND sd.languages_id = ${LANGUAGE_ID_ENGLISH}
    LEFT JOIN subcategories sc
      ON sc.subjects_id = s.subjects_id
  `;

  console.log(`Found ${rows.length} legacy subject-class linkages`);

  // Build class legacy_id → new id map
  const classes = await prisma.class.findMany({ where: { legacyId: { not: null } } });
  const classMap = new Map<number, number>();
  for (const c of classes) if (c.legacyId !== null) classMap.set(c.legacyId, c.id);

  // Group by (newClassId, normalized name)
  type Key = string;
  const groups = new Map<Key, { newClassId: number; name: string; legacyIds: number[]; anyActive: boolean }>();
  let skippedNoClass = 0, skippedNoName = 0;

  for (const r of rows) {
    const name = stripHtml(r.subject_name);
    if (!name) { skippedNoName++; continue; }
    if (!r.categories_id) { skippedNoClass++; continue; }
    const newClassId = classMap.get(r.categories_id);
    if (!newClassId) { skippedNoClass++; continue; }

    const k = `${newClassId}|${name.toLowerCase()}`;
    const existing = groups.get(k);
    if (existing) {
      existing.legacyIds.push(r.subjects_id);
      existing.anyActive = existing.anyActive || r.subjects_status === 1;
    } else {
      groups.set(k, { newClassId, name, legacyIds: [r.subjects_id], anyActive: r.subjects_status === 1 });
    }
  }

  console.log(`Unique canonical subjects: ${groups.size} (skipped no-class=${skippedNoClass}, no-name=${skippedNoName})`);

  // Upsert each canonical subject (use first legacyId as the trace)
  const legacyToNew = new Map<number, number>();
  let created = 0, updated = 0;
  for (const g of groups.values()) {
    const traceLegacyId = g.legacyIds[0];
    const existing = await prisma.subject.findUnique({ where: { legacyId: traceLegacyId } });
    const result = await prisma.subject.upsert({
      where: { legacyId: traceLegacyId },
      create: {
        legacyId: traceLegacyId,
        classId: g.newClassId,
        name: g.name,
        isActive: g.anyActive,
        sortOrder: 0,
      },
      update: { name: g.name, classId: g.newClassId, isActive: g.anyActive },
    });
    for (const lid of g.legacyIds) legacyToNew.set(lid, result.id);
    if (existing) updated++; else created++;
  }

  // Persist mapping for downstream scripts
  const mapPath = path.join(__dirname, "_subject-map.json");
  fs.writeFileSync(mapPath, JSON.stringify(Object.fromEntries(legacyToNew), null, 0));
  console.log(`✔ created=${created}, updated=${updated} · wrote map (${legacyToNew.size} legacy IDs → new) to ${path.basename(mapPath)}`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
