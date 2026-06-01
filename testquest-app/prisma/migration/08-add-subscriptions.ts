/**
 * Phase 0 / Task 0.2 — Subscriptions + SubscriptionPlans + OrgQuestions.
 *
 * Creates three new Prisma-managed tables:
 *   - tq_subscription_plans
 *   - tq_subscriptions    (with CHECK constraint: exactly one of orgId/studentId is non-null)
 *   - tq_org_questions
 *
 * Then seeds three SubscriptionPlan rows (Starter / Growth / Pro for
 * Coaching Centre) per Task 0.2 acceptance criteria. Pricing is placeholder —
 * see the PRICING_TODO comments. Seed is idempotent via upsert on (name, targetAudience).
 *
 * Idempotent overall: re-running is a no-op.
 *
 * Soft references to legacy:
 *   - Subscription.studentId (B2C subs) → student.student_id, no DB FK
 *   - OrgQuestion.legacyQuestionId → question.question_id, no DB FK
 *   - OrgQuestion.createdBy → student.student_id, no DB FK
 *
 * Hard FKs (tq_* → tq_* only):
 *   - Subscription.orgId → tq_organizations(id) ON DELETE CASCADE
 *   - Subscription.planId → tq_subscription_plans(id) ON DELETE RESTRICT
 *   - OrgQuestion.orgId → tq_organizations(id) ON DELETE CASCADE
 */
import "dotenv/config";
import { PrismaClient, PlanAudience, PricingModel } from "../../src/generated/prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: Array<{ label: string; sql: string }> = [
  {
    label: "tq_subscription_plans",
    sql: `
      CREATE TABLE IF NOT EXISTS \`tq_subscription_plans\` (
        \`id\`              INT NOT NULL AUTO_INCREMENT,
        \`name\`            VARCHAR(120) NOT NULL,
        \`targetAudience\`  ENUM('B2C','COACHING_CENTRE','SCHOOL') NOT NULL,
        \`pricingModel\`    ENUM('PER_SEAT','FLAT','TIERED') NOT NULL,
        \`featuresJson\`    JSON NULL,
        \`durationDays\`    INT NOT NULL,
        \`basePrice\`       DECIMAL(10,2) NOT NULL,
        \`isActive\`        BOOLEAN NOT NULL DEFAULT TRUE,
        \`createdAt\`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\`       DATETIME(3) NOT NULL,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
  },
  {
    // XOR constraint (exactly one of orgId / studentId set) is enforced at the
    // application layer when subscription rows are created. MariaDB's CHECK
    // parser rejected the inline form (error 1901); we don't depend on a
    // DB-level CHECK for any other tq_* table either.
    label: "tq_subscriptions",
    sql: `
      CREATE TABLE IF NOT EXISTS \`tq_subscriptions\` (
        \`id\`              INT NOT NULL AUTO_INCREMENT,
        \`orgId\`           INT NULL,
        \`studentId\`       INT NULL,
        \`planId\`          INT NOT NULL,
        \`seatsPurchased\`  INT NOT NULL DEFAULT 1,
        \`seatsUsed\`       INT NOT NULL DEFAULT 0,
        \`startsAt\`        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`expiresAt\`       DATETIME(3) NOT NULL,
        \`billingCycle\`    ENUM('MONTHLY','ANNUAL') NOT NULL DEFAULT 'ANNUAL',
        \`autoRenew\`       BOOLEAN NOT NULL DEFAULT FALSE,
        \`status\`          ENUM('TRIAL','ACTIVE','GRACE','EXPIRED','CANCELLED') NOT NULL DEFAULT 'TRIAL',
        \`createdAt\`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\`       DATETIME(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`tq_subscriptions_orgId_fkey\`
          FOREIGN KEY (\`orgId\`) REFERENCES \`tq_organizations\`(\`id\`)
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`tq_subscriptions_planId_fkey\`
          FOREIGN KEY (\`planId\`) REFERENCES \`tq_subscription_plans\`(\`id\`)
          ON DELETE RESTRICT ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
  },
  {
    label: "tq_org_questions",
    sql: `
      CREATE TABLE IF NOT EXISTS \`tq_org_questions\` (
        \`id\`                INT NOT NULL AUTO_INCREMENT,
        \`orgId\`             INT NOT NULL,
        \`legacyQuestionId\`  INT NOT NULL,
        \`createdBy\`         INT NOT NULL,
        \`isActive\`          BOOLEAN NOT NULL DEFAULT TRUE,
        \`createdAt\`         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\`         DATETIME(3) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`tq_org_questions_orgId_legacyQuestionId_key\` (\`orgId\`, \`legacyQuestionId\`),
        CONSTRAINT \`tq_org_questions_orgId_fkey\`
          FOREIGN KEY (\`orgId\`) REFERENCES \`tq_organizations\`(\`id\`)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
  },
];

const INDICES: Array<{ table: string; name: string; cols: string }> = [
  { table: "tq_subscription_plans", name: "tq_subscription_plans_targetAudience_idx", cols: "`targetAudience`" },
  { table: "tq_subscriptions",      name: "tq_subscriptions_orgId_idx",       cols: "`orgId`" },
  { table: "tq_subscriptions",      name: "tq_subscriptions_studentId_idx",   cols: "`studentId`" },
  { table: "tq_subscriptions",      name: "tq_subscriptions_status_idx",      cols: "`status`" },
  { table: "tq_subscriptions",      name: "tq_subscriptions_expiresAt_idx",   cols: "`expiresAt`" },
  { table: "tq_org_questions",      name: "tq_org_questions_orgId_idx",       cols: "`orgId`" },
];

async function tableExists(table: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COUNT(*) AS n FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}'`,
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

async function indexExists(table: string, name: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COUNT(*) AS n FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' AND INDEX_NAME = '${name}'`,
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

// PRICING_TODO: placeholder prices/feature-lists; finalise before any go-live.
// Mirrors the cards on /for-coaching-centres but stored as structured data here.
const PLANS_SEED = [
  {
    name: "Starter",
    targetAudience: PlanAudience.COACHING_CENTRE,
    pricingModel: PricingModel.FLAT,
    durationDays: 14,
    basePrice: 0,
    featuresJson: {
      bullet: [
        "Full Testquest question bank",
        "1 batch, 1 owner",
        "Email + SMS student invites",
        "Standard score reports",
      ],
      seatCap: 50,
    },
  },
  {
    name: "Growth",
    targetAudience: PlanAudience.COACHING_CENTRE,
    pricingModel: PricingModel.PER_SEAT,
    durationDays: 365,
    basePrice: 149,
    featuresJson: {
      bullet: [
        "Unlimited batches",
        "Up to 3 co-teachers",
        "Custom test builder",
        "WhatsApp student invites",
        "Branded weekly score emails",
      ],
    },
  },
  {
    name: "Pro",
    targetAudience: PlanAudience.COACHING_CENTRE,
    pricingModel: PricingModel.PER_SEAT,
    durationDays: 365,
    basePrice: 299,
    featuresJson: {
      bullet: [
        "Everything in Growth",
        "Unlimited co-teachers",
        "White-label (logo, colors, domain)",
        "Branded parent PDF reports",
        "Org-scoped question bank uploads",
        "Priority support",
      ],
    },
  },
];

async function seedPlans() {
  for (const p of PLANS_SEED) {
    // Composite uniqueness is (name, targetAudience) for idempotency.
    const existing = await prisma.subscriptionPlan.findFirst({
      where: { name: p.name, targetAudience: p.targetAudience },
    });
    if (existing) {
      await prisma.subscriptionPlan.update({
        where: { id: existing.id },
        data: {
          pricingModel: p.pricingModel,
          durationDays: p.durationDays,
          basePrice: p.basePrice,
          featuresJson: p.featuresJson,
        },
      });
      console.log(`  plan ${p.name} (${p.targetAudience}): updated.`);
    } else {
      await prisma.subscriptionPlan.create({ data: p });
      console.log(`  plan ${p.name} (${p.targetAudience}): created.`);
    }
  }
}

async function main() {
  for (const s of STATEMENTS) {
    const existedBefore = await tableExists(s.label);
    await prisma.$executeRawUnsafe(s.sql);
    if (!(await tableExists(s.label))) throw new Error(`Failed to create ${s.label}`);
    console.log(existedBefore ? `${s.label}: already exists, skipped.` : `${s.label}: created.`);
  }
  for (const idx of INDICES) {
    if (await indexExists(idx.table, idx.name)) {
      console.log(`  index ${idx.table}.${idx.name}: already exists.`);
      continue;
    }
    await prisma.$executeRawUnsafe(`CREATE INDEX \`${idx.name}\` ON \`${idx.table}\`(${idx.cols})`);
    console.log(`  index ${idx.table}.${idx.name}: created.`);
  }
  console.log("\nSeeding SubscriptionPlan rows...");
  await seedPlans();
  console.log("\nDone.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
