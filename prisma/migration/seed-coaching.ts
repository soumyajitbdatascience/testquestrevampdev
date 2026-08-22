/**
 * Phase 0 / Task 0.4 — Idempotent dev-data seed for the coaching layer.
 *
 * Creates:
 *  - 1 Organization "Sunrise Coaching Centre" (Pune, COACHING_CENTRE)
 *  - 1 legacy `student` row "Demo Owner" (demo-owner@testquest.local / demo1234)
 *  - 1 OrgMembership linking them as OWNER
 *  - 1 Subscription (TRIAL, 14 days, plan=Starter, seats=50)
 *  - 1 Batch "Class 10 CBSE Morning 2026"
 *  - 5 demo students + their BatchEnrollments
 *
 * Run via:  `npm run seed:coaching`  (or `npx tsx prisma/migration/seed-coaching.ts`)
 *
 * Idempotent: looks up by stable keys (email for students, name for org,
 * name+orgId for batch, etc.) and updates rather than duplicates. Safe to
 * re-run.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import {
  PrismaClient,
  OrgType,
  OrgRole,
  SubscriptionStatus,
} from "../../src/generated/prisma/client";

const prisma = new PrismaClient();

const OWNER_EMAIL = "demo-owner@testquest.local";
const OWNER_PASSWORD = "demo1234";
const ORG_NAME = "Sunrise Coaching Centre";
const BATCH_NAME = "Class 10 CBSE Morning 2026";

const DEMO_STUDENTS = [
  { name: "Priya Raman",     email: "demo-priya@testquest.local"   },
  { name: "Aman Sharma",     email: "demo-aman@testquest.local"    },
  { name: "Rhea Iyer",       email: "demo-rhea@testquest.local"    },
  { name: "Karan Mehta",     email: "demo-karan@testquest.local"   },
  { name: "Sneha Patel",     email: "demo-sneha@testquest.local"   },
];

// Class 10 CBSE in legacy is category_id 37 (matches an existing class — change
// here if your DB uses a different id). Falls back to 25 (Pre-Foundation) if 37
// is missing, just to keep the seed non-fatal.
async function pickClassId(): Promise<number> {
  const r = await prisma.$queryRaw<Array<{ id: number }>>`SELECT id FROM vw_classes WHERE id = 37 AND isActive = 1 LIMIT 1`;
  if (r.length) return 37;
  return 25;
}

async function upsertLegacyStudent(name: string, email: string, passwordHash: string | null): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT student_id AS id FROM student WHERE email_address = ${email} LIMIT 1
  `;
  if (rows.length) return rows[0].id;

  const [first, ...rest] = name.split(" ");
  const surname = rest.join(" ") || "";
  const account = `seed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();
  await prisma.$executeRawUnsafe(
    `INSERT INTO student (
       category_id, subcategories_id, first_name, second_name, surname_name,
       mobile_no, email_address, username,
       password, encrypt_password,
       status, payment_status,
       student_language_default_name, student_language_default_code,
       student_language_default_id, student_language_default_directory,
       registration_date, account_number, mail_activation, avatar
     ) VALUES (
       ?, 0, ?, '', ?,
       '', ?, ?,
       ?, '',
       1, 0,
       'English', 'EN',
       3, 'english',
       ?, ?, 1, ''
     )`,
    37, first, surname,
    email, email.split("@")[0],
    passwordHash ?? "",
    now, account,
  );
  const fresh = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT student_id AS id FROM student WHERE email_address = ${email} ORDER BY student_id DESC LIMIT 1
  `;
  return Number(fresh[0]!.id);
}

async function main() {
  // 1. Owner student row
  const ownerHash = await bcrypt.hash(OWNER_PASSWORD, 12);
  const ownerId = await upsertLegacyStudent("Demo Owner", OWNER_EMAIL, ownerHash);
  console.log(`owner student_id=${ownerId} (${OWNER_EMAIL})`);

  // 2. Organization
  let org = await prisma.organization.findFirst({ where: { name: ORG_NAME, ownerUserId: ownerId } });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: ORG_NAME, type: OrgType.COACHING_CENTRE, city: "Pune", ownerUserId: ownerId },
    });
    console.log(`org created id=${org.id}`);
  } else {
    console.log(`org already exists id=${org.id}`);
  }

  // 3. Owner membership
  const existingMembership = await prisma.orgMembership.findUnique({
    where: { orgId_userId_role: { orgId: org.id, userId: ownerId, role: OrgRole.OWNER } },
  }).catch(() => null);
  if (!existingMembership) {
    await prisma.orgMembership.create({
      data: { orgId: org.id, userId: ownerId, role: OrgRole.OWNER },
    });
    console.log("owner membership created");
  } else {
    console.log("owner membership already exists");
  }

  // 4. Trial subscription (Starter plan, 14 days, 50 seats)
  const starter = await prisma.subscriptionPlan.findFirst({
    where: { name: "Starter", targetAudience: "COACHING_CENTRE" },
  });
  if (!starter) throw new Error("Starter plan not found — run Task 0.2 migration first.");

  const activeSub = await prisma.subscription.findFirst({ where: { orgId: org.id } });
  if (!activeSub) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);
    await prisma.subscription.create({
      data: {
        orgId: org.id, planId: starter.id, seatsPurchased: 50, seatsUsed: 0,
        expiresAt, status: SubscriptionStatus.TRIAL,
      },
    });
    console.log("trial subscription created");
  } else {
    console.log("subscription already exists, skipping");
  }

  // 5. Batch
  const classId = await pickClassId();
  let batch = await prisma.batch.findFirst({ where: { orgId: org.id, name: BATCH_NAME } });
  if (!batch) {
    batch = await prisma.batch.create({
      data: { orgId: org.id, name: BATCH_NAME, classId, board: "CBSE", subjectsCsv: "Mathematics,Science,English,Social Science" },
    });
    console.log(`batch created id=${batch.id}`);
  } else {
    console.log(`batch already exists id=${batch.id}`);
  }

  // 6. Demo students + enrollments + STUDENT org memberships
  for (const s of DEMO_STUDENTS) {
    const sid = await upsertLegacyStudent(s.name, s.email, null);
    const existingEnroll = await prisma.batchEnrollment.findUnique({
      where: { batchId_studentId: { batchId: batch.id, studentId: sid } },
    }).catch(() => null);
    if (!existingEnroll) {
      await prisma.batchEnrollment.create({ data: { batchId: batch.id, studentId: sid } });
      console.log(`  enrolled ${s.name} (${sid})`);
    }
    const existingMembership = await prisma.orgMembership.findUnique({
      where: { orgId_userId_role: { orgId: org.id, userId: sid, role: OrgRole.STUDENT } },
    }).catch(() => null);
    if (!existingMembership) {
      await prisma.orgMembership.create({ data: { orgId: org.id, userId: sid, role: OrgRole.STUDENT } });
    }
  }

  // Keep Subscription.seatsUsed in sync with active members.
  const activeMembers = await prisma.orgMembership.count({ where: { orgId: org.id, isActive: true } });
  await prisma.subscription.updateMany({
    where: { orgId: org.id, status: { in: ["TRIAL", "ACTIVE", "GRACE"] } },
    data: { seatsUsed: activeMembers },
  });

  console.log(`\nSeed complete.\n  Login at /coaching/login with:\n    ${OWNER_EMAIL}\n    ${OWNER_PASSWORD}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
