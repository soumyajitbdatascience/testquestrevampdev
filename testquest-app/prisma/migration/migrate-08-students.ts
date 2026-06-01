/**
 * Migrate legacy `student` → tq_students.
 *
 * - Email is unique; on duplicate keep most recently active row
 * - Port bcrypt password only if it starts with `$2`; otherwise leave null (forces password reset)
 */
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
import { composeName, normalizeEmail } from "./_helpers";

const prisma = new PrismaClient();
const BATCH_SIZE = 200;

interface LegacyStudent {
  student_id: number;
  first_name: string | null;
  second_name: string | null;
  surname_name: string | null;
  email_address: string | null;
  username: string | null;
  mobile_no: string | null;
  password: string | null;
  category_id: number | null;
  status: number;
  registration_date: Date | null;
}

async function main() {
  console.log("=== migrate-08-students ===");

  const classes = await prisma.class.findMany({ where: { legacyId: { not: null } } });
  const classMap = new Map<number, number>();
  for (const c of classes) if (c.legacyId !== null) classMap.set(c.legacyId, c.id);

  const legacy = await prisma.$queryRaw<LegacyStudent[]>`
    SELECT
      student_id, first_name, second_name, surname_name,
      email_address, username, mobile_no, password,
      category_id, status, registration_date
    FROM student
    ORDER BY student_id
  `;
  console.log(`Found ${legacy.length} legacy students`);

  // Dedupe by email — keep the row with status=1 + latest registration_date
  type Picked = LegacyStudent & { _email: string };
  const byEmail = new Map<string, Picked>();
  let skippedNoEmail = 0;
  for (const s of legacy) {
    const em = normalizeEmail(s.email_address);
    if (!em) { skippedNoEmail++; continue; }
    const existing = byEmail.get(em);
    if (!existing) { byEmail.set(em, { ...s, _email: em }); continue; }
    // Pick winner
    const aActive = s.status === 1, bActive = existing.status === 1;
    if (aActive && !bActive) { byEmail.set(em, { ...s, _email: em }); continue; }
    if (!aActive && bActive) continue;
    // Both same activeness — pick latest registration
    const aDate = s.registration_date ? +s.registration_date : 0;
    const bDate = existing.registration_date ? +existing.registration_date : 0;
    if (aDate > bDate) byEmail.set(em, { ...s, _email: em });
  }
  console.log(`After email dedup: ${byEmail.size} unique students (skipped no-email=${skippedNoEmail})`);

  // Existing legacy IDs
  const existing = await prisma.student.findMany({
    where: { legacyId: { not: null } },
    select: { legacyId: true },
  });
  const existingIds = new Set(existing.map(e => e.legacyId));

  let toInsert: Parameters<typeof prisma.student.createMany>[0]["data"] = [];
  let inserted = 0, skippedAlready = 0;

  for (const s of byEmail.values()) {
    if (existingIds.has(s.student_id)) { skippedAlready++; continue; }

    const name = composeName(s.first_name, s.second_name, s.surname_name, s.username);
    const passwordHash = s.password && s.password.startsWith("$2") ? s.password : null;
    const mobile = (s.mobile_no || "").replace(/\D/g, "").slice(0, 20) || null;
    const classId = s.category_id ? classMap.get(s.category_id) ?? null : null;

    toInsert.push({
      legacyId: s.student_id,
      name,
      email: s._email,
      mobile,
      passwordHash,
      classId,
      board: null,
      isActive: s.status === 1,
    });

    if (toInsert.length >= BATCH_SIZE) {
      await prisma.student.createMany({ data: toInsert, skipDuplicates: true });
      inserted += toInsert.length;
      process.stdout.write(`  inserted ${inserted}…\r`);
      toInsert = [];
    }
  }
  if (toInsert.length > 0) {
    await prisma.student.createMany({ data: toInsert, skipDuplicates: true });
    inserted += toInsert.length;
  }

  console.log(`\n✔ inserted=${inserted}, already=${skippedAlready}`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
