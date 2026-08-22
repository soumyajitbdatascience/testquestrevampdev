/**
 * organization-admin service — Phase 2 / Task 2.5.
 *
 * Owns the Testquest-staff "sales-led" path:
 *   - List + filter coaching orgs with subscription state and CRM fields
 *   - Create a centre on behalf of the owner, email them a magic-link to
 *     set their password
 *   - Surface a centre's members / batches / subscription / sales notes
 *   - Update lightweight CRM fields (sales stage, next follow-up, notes)
 *   - Resend the welcome magic link
 *
 * Mirrors `legacy-students.setPasswordResetToken` for the magic link so we
 * don't introduce a third token table — `password_reset_token` already
 * carries the right semantics (single-use, time-boxed).
 */
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  OrgType,
  OrgRole,
  SubscriptionStatus,
  type Organization,
  type Prisma,
} from "@/generated/prisma/client";
import { createLegacyStudent, findByEmail, setPasswordResetToken } from "@/lib/legacy-students";
import { sendNotification } from "@/lib/notifications";
import { buildEmailBranding } from "@/lib/branding-for-email";

// ─── Shapes ────────────────────────────────────────────────────────

export type SalesStage = "PROSPECT" | "DEMO" | "PILOT" | "ACTIVE" | "CHURNED";
export type OnboardingPath = "SELF_SERVE" | "SALES_LED";

export interface SalesJson {
  salesStage?: SalesStage;
  nextFollowupAt?: string; // ISO date
  salesNotes?: string;
  onboardingPath?: OnboardingPath;
}

export class OrgAdminError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

const WELCOME_TTL_DAYS = 14;

function newToken(): string {
  return randomBytes(24).toString("hex");
}

function welcomeUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base}/coaching/welcome/${token}`;
}

function readSales(o: Pick<Organization, "salesJson">): SalesJson {
  return (o.salesJson ?? {}) as SalesJson;
}

// ─── List ──────────────────────────────────────────────────────────

export interface ListOrgsInput {
  type?: OrgType;
  status?: SubscriptionStatus;
  planId?: number;
  salesStage?: SalesStage;
  onboardingPath?: OnboardingPath;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface OrgListItem {
  id: number;
  name: string;
  type: OrgType;
  city: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  memberCount: number;
  batchCount: number;
  studentCount: number;
  subscription: {
    status: SubscriptionStatus | null;
    planName: string | null;
    expiresAt: Date | null;
  } | null;
  salesStage: SalesStage | null;
  nextFollowupAt: string | null;
  onboardingPath: OnboardingPath | null;
  createdAt: Date;
}

export interface ListOrgsResult {
  rows: OrgListItem[];
  total: number;
  limit: number;
  offset: number;
}

export async function listOrganizations(input: ListOrgsInput = {}): Promise<ListOrgsResult> {
  const limit = Math.min(100, Math.max(1, input.limit ?? 25));
  const offset = Math.max(0, input.offset ?? 0);

  const where: Prisma.OrganizationWhereInput = {};
  if (input.type) where.type = input.type;
  if (input.q && input.q.trim().length > 0) where.name = { contains: input.q.trim() };
  // Subscription filters require post-fetch narrowing; we filter loosely at DB
  // and re-narrow in code so the WHERE stays simple. For MVP volumes that's fine.

  const [orgs, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      include: {
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { plan: { select: { name: true } } },
        },
        _count: {
          select: {
            memberships: { where: { isActive: true, role: { in: ["OWNER", "ADMIN", "TEACHER"] } } },
            batches: { where: { isActive: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    }),
    prisma.organization.count({ where }),
  ]);

  // Student counts (STUDENT role) in one batched query.
  const studentCounts = orgs.length === 0 ? [] : await prisma.orgMembership.groupBy({
    by: ["orgId"],
    where: { orgId: { in: orgs.map((o) => o.id) }, role: "STUDENT", isActive: true },
    _count: { orgId: true },
  });
  const studentByOrg = new Map(studentCounts.map((s) => [s.orgId, s._count.orgId]));

  // Owner name + email lookup (one query for everyone).
  const ownerIds = Array.from(new Set(orgs.map((o) => o.ownerUserId)));
  const owners = ownerIds.length === 0 ? [] : await prisma.$queryRawUnsafe<Array<{
    id: number; name: string; email: string | null;
  }>>(
    `SELECT id, name, email FROM vw_students WHERE id IN (${ownerIds.map(() => "?").join(",")})`,
    ...ownerIds,
  );
  const ownerById = new Map(owners.map((o) => [Number(o.id), o]));

  let rows: OrgListItem[] = orgs.map((o) => {
    const sub = o.subscriptions[0];
    const sj = readSales(o);
    const owner = ownerById.get(o.ownerUserId);
    return {
      id: o.id,
      name: o.name,
      type: o.type,
      city: o.city,
      ownerName: owner?.name ?? null,
      ownerEmail: owner?.email ?? null,
      memberCount: o._count.memberships,
      batchCount: o._count.batches,
      studentCount: studentByOrg.get(o.id) ?? 0,
      subscription: sub ? {
        status: sub.status,
        planName: sub.plan?.name ?? null,
        expiresAt: sub.expiresAt,
      } : null,
      salesStage: sj.salesStage ?? null,
      nextFollowupAt: sj.nextFollowupAt ?? null,
      onboardingPath: sj.onboardingPath ?? null,
      createdAt: o.createdAt,
    };
  });

  // Post-filter on subscription/CRM fields (volume is low; keeps WHERE simple).
  if (input.status) rows = rows.filter((r) => r.subscription?.status === input.status);
  if (input.planId) rows = rows.filter((r) => r.subscription?.planName != null && false); // planId filter would need plan id on sub; skip for MVP since we filter by status instead.
  if (input.salesStage) rows = rows.filter((r) => r.salesStage === input.salesStage);
  if (input.onboardingPath) rows = rows.filter((r) => r.onboardingPath === input.onboardingPath);

  return { rows, total, limit, offset };
}

// ─── Detail ────────────────────────────────────────────────────────

export interface OrgDetailMember {
  membershipId: number;
  userId: number;
  role: OrgRole;
  name: string | null;
  email: string | null;
  joinedAt: Date;
  isActive: boolean;
}

export interface OrgDetailBatch {
  id: number;
  name: string;
  className: string | null;
  studentCount: number;
  createdAt: Date;
  isActive: boolean;
}

export interface OrgDetail {
  id: number;
  name: string;
  type: OrgType;
  city: string | null;
  logoUrl: string | null;
  parentOrgId: number | null;
  ownerUserId: number;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerHasPassword: boolean;
  createdAt: Date;
  members: OrgDetailMember[];
  batches: OrgDetailBatch[];
  subscription: {
    status: SubscriptionStatus;
    planName: string;
    seatsPurchased: number;
    expiresAt: Date | null;
    createdAt: Date;
  } | null;
  stats: {
    members: number;
    batches: number;
    students: number;
    assignmentsThisWeek: number;
  };
  sales: SalesJson;
}

export async function getOrganizationDetail(orgId: number): Promise<OrgDetail | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      subscriptions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { plan: { select: { name: true } } },
      },
    },
  });
  if (!org) return null;

  const [memberships, batches, assignmentsThisWeek] = await Promise.all([
    prisma.orgMembership.findMany({
      where: { orgId, role: { in: ["OWNER", "ADMIN", "TEACHER"] } },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    }),
    prisma.batch.findMany({
      where: { orgId },
      include: { _count: { select: { enrollments: { where: { isActive: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.assignment.count({
      where: {
        orgId,
        isActive: true,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
      },
    }),
  ]);

  // Look up legacy students for member names + the owner's password status.
  const userIds = Array.from(new Set([
    org.ownerUserId,
    ...memberships.map((m) => m.userId),
  ]));
  const placeholders = userIds.map(() => "?").join(",");
  const vwStudents = await prisma.$queryRawUnsafe<Array<{ id: number; name: string; email: string | null }>>(
    `SELECT id, name, email FROM vw_students WHERE id IN (${placeholders})`,
    ...userIds,
  );
  const byId = new Map(vwStudents.map((s) => [Number(s.id), s]));

  const ownerPasswordRows = await prisma.$queryRawUnsafe<Array<{ password: string | null }>>(
    `SELECT password FROM student WHERE student_id = ? LIMIT 1`,
    org.ownerUserId,
  );
  const ownerHasPassword = !!(ownerPasswordRows[0]?.password && ownerPasswordRows[0].password.length > 0);

  const classIds = Array.from(new Set(batches.map((b) => b.classId).filter((x): x is number => x != null)));
  let classNameById = new Map<number, string>();
  if (classIds.length > 0) {
    const classRows = await prisma.$queryRawUnsafe<Array<{ id: number; name: string }>>(
      `SELECT id, name FROM vw_classes WHERE id IN (${classIds.map(() => "?").join(",")})`,
      ...classIds,
    );
    classNameById = new Map(classRows.map((c) => [Number(c.id), c.name]));
  }

  const owner = byId.get(org.ownerUserId);
  const studentTotal = await prisma.orgMembership.count({
    where: { orgId, role: "STUDENT", isActive: true },
  });

  const sub = org.subscriptions[0];

  return {
    id: org.id,
    name: org.name,
    type: org.type,
    city: org.city,
    logoUrl: org.logoUrl,
    parentOrgId: org.parentOrgId,
    ownerUserId: org.ownerUserId,
    ownerName: owner?.name ?? null,
    ownerEmail: owner?.email ?? null,
    ownerHasPassword,
    createdAt: org.createdAt,
    members: memberships.map((m) => ({
      membershipId: m.id,
      userId: m.userId,
      role: m.role,
      name: byId.get(m.userId)?.name ?? null,
      email: byId.get(m.userId)?.email ?? null,
      joinedAt: m.joinedAt,
      isActive: m.isActive,
    })),
    batches: batches.map((b) => ({
      id: b.id,
      name: b.name,
      className: b.classId ? classNameById.get(b.classId) ?? null : null,
      studentCount: b._count.enrollments,
      createdAt: b.createdAt,
      isActive: b.isActive,
    })),
    subscription: sub ? {
      status: sub.status,
      planName: sub.plan?.name ?? "—",
      seatsPurchased: sub.seatsPurchased,
      expiresAt: sub.expiresAt,
      createdAt: sub.createdAt,
    } : null,
    stats: {
      members: memberships.length,
      batches: batches.length,
      students: studentTotal,
      assignmentsThisWeek,
    },
    sales: readSales(org),
  };
}

// ─── Create (sales-led) ────────────────────────────────────────────

export interface CreateSalesLedInput {
  name: string;
  city?: string | null;
  type?: OrgType; // defaults to COACHING_CENTRE
  ownerName: string;
  ownerEmail: string;
  planId: number;
  seatsPurchased?: number;
  salesStage?: SalesStage;
  salesNotes?: string;
  nextFollowupAt?: string | null;
}

export interface CreateSalesLedResult {
  orgId: number;
  ownerUserId: number;
  welcomeToken: string;
  welcomeUrl: string;
  emailDelivered: boolean;
}

export async function createOrganizationSalesLed(input: CreateSalesLedInput): Promise<CreateSalesLedResult> {
  const email = input.ownerEmail.trim().toLowerCase();
  if (!email.includes("@")) throw new OrgAdminError("BAD_EMAIL", "That owner email doesn't look right.");
  if (input.name.trim().length < 2) throw new OrgAdminError("BAD_NAME", "Give the centre a name (at least 2 characters).");
  if (input.ownerName.trim().length < 2) throw new OrgAdminError("BAD_OWNER", "Owner name is required.");

  // Existing legacy student with this email?
  const existing = await findByEmail(email);
  if (existing) {
    // For MVP we don't let the same email become OWNER of a second org — it
    // makes the "who am I signed in as" flow ambiguous. If staff really need
    // to do this, do it manually in the DB.
    const inOtherOrg = await prisma.orgMembership.findFirst({
      where: { userId: existing.id, role: "OWNER", isActive: true },
    });
    if (inOtherOrg) {
      throw new OrgAdminError("OWNER_BUSY", "That email already owns another centre on Testquest.", 409);
    }
  }

  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: input.planId } });
  if (!plan || !plan.isActive) {
    throw new OrgAdminError("BAD_PLAN", "Pick an active plan.", 422);
  }

  // 1. Legacy student row — empty password until the owner sets one via welcome link.
  let ownerUserId: number;
  if (existing) {
    ownerUserId = existing.id;
  } else {
    ownerUserId = await createLegacyStudent({
      name: input.ownerName,
      email,
      passwordHash: "", // empty until welcome accept
      classId: null,
      board: null,
    });
  }

  // 2. Org + membership + trial subscription in one Prisma txn.
  const trialDays = 14;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + trialDays);
  const seatsPurchased = Math.max(10, input.seatsPurchased ?? 50);
  const salesJson: SalesJson = {
    onboardingPath: "SALES_LED",
    salesStage: input.salesStage ?? "PROSPECT",
    salesNotes: input.salesNotes?.trim() || undefined,
    nextFollowupAt: input.nextFollowupAt || undefined,
  };

  const org = await prisma.$transaction(async (tx) => {
    const created = await tx.organization.create({
      data: {
        name: input.name.trim(),
        type: input.type ?? OrgType.COACHING_CENTRE,
        city: input.city?.trim() || null,
        ownerUserId,
        salesJson: salesJson as unknown as Prisma.InputJsonValue,
      },
    });
    await tx.orgMembership.create({
      data: { orgId: created.id, userId: ownerUserId, role: OrgRole.OWNER },
    });
    await tx.subscription.create({
      data: {
        orgId: created.id,
        planId: plan.id,
        seatsPurchased,
        expiresAt,
        status: SubscriptionStatus.TRIAL,
      },
    });
    return created;
  });

  // 3. Magic-link token via the existing password-reset plumbing.
  const token = newToken();
  const tokenExpiry = new Date();
  tokenExpiry.setDate(tokenExpiry.getDate() + WELCOME_TTL_DAYS);
  await setPasswordResetToken(email, token, tokenExpiry);

  // 4. Welcome notification.
  const url = welcomeUrl(token);
  // Brand-new sales-led orgs likely have no white-label settings yet — and
  // the plan starts on TRIAL so the gate allows the lookup. If readBranding
  // returns all-empty, buildEmailBranding still yields a sensible payload
  // with the org's display name as fallback.
  const branding = await buildEmailBranding(org.id);
  const sent = await sendNotification({
    template: "welcome",
    params: {
      ownerFirstName: input.ownerName.trim().split(" ")[0] || "there",
      orgName: input.name.trim(),
      url,
      ttlDays: WELCOME_TTL_DAYS,
    },
    recipient: { email, branding },
  });

  return {
    orgId: org.id,
    ownerUserId,
    welcomeToken: token,
    welcomeUrl: url,
    emailDelivered: sent.delivered,
  };
}

// ─── Update CRM ────────────────────────────────────────────────────

export interface UpdateCrmInput {
  salesStage?: SalesStage;
  salesNotes?: string | null;
  nextFollowupAt?: string | null;
}

export async function updateOrganizationCrm(orgId: number, input: UpdateCrmInput): Promise<SalesJson> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { salesJson: true },
  });
  if (!org) throw new OrgAdminError("NOT_FOUND", "Organization not found.", 404);
  const cur = readSales(org);
  const next: SalesJson = {
    ...cur,
    salesStage: input.salesStage ?? cur.salesStage,
    salesNotes: input.salesNotes === null ? undefined : (input.salesNotes ?? cur.salesNotes),
    nextFollowupAt: input.nextFollowupAt === null ? undefined : (input.nextFollowupAt ?? cur.nextFollowupAt),
  };
  await prisma.organization.update({
    where: { id: orgId },
    data: { salesJson: next as unknown as Prisma.InputJsonValue },
  });
  return next;
}

// ─── Parent link (Task 4.4) ────────────────────────────────────────

/**
 * Set or clear the `parentOrgId` link for an organisation. Guards against
 * self-reference (A can't parent itself) and the simplest two-node cycle
 * (A→B and B→A). Deeper cycle detection is deferred — branch trees are
 * shallow in practice and admin-only.
 */
export async function updateOrganizationParent(
  orgId: number,
  parentOrgId: number | null,
): Promise<{ id: number; parentOrgId: number | null }> {
  if (parentOrgId !== null && parentOrgId === orgId) {
    throw new OrgAdminError("SELF_PARENT", "An org can't be its own parent.", 422);
  }
  if (parentOrgId !== null) {
    const parent = await prisma.organization.findUnique({
      where: { id: parentOrgId },
      select: { parentOrgId: true },
    });
    if (!parent) throw new OrgAdminError("PARENT_NOT_FOUND", "Parent org doesn't exist.", 422);
    if (parent.parentOrgId === orgId) {
      throw new OrgAdminError("CYCLE", "That would create a hierarchy cycle.", 422);
    }
  }
  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: { parentOrgId },
    select: { id: true, parentOrgId: true },
  });
  return updated;
}

// ─── Resend welcome ────────────────────────────────────────────────

export async function resendOwnerInvite(orgId: number): Promise<{ url: string; emailDelivered: boolean }> {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new OrgAdminError("NOT_FOUND", "Organization not found.", 404);

  const ownerRows = await prisma.$queryRawUnsafe<Array<{ student_id: number; email_address: string; first_name: string; password: string }>>(
    `SELECT student_id, email_address, first_name, password FROM student WHERE student_id = ? LIMIT 1`,
    org.ownerUserId,
  );
  const owner = ownerRows[0];
  if (!owner) throw new OrgAdminError("NO_OWNER", "Owner record is missing.", 422);
  if (owner.password && owner.password.length > 0) {
    throw new OrgAdminError("ALREADY_ACTIVE", "Owner has already set their password.", 409);
  }

  const token = newToken();
  const tokenExpiry = new Date();
  tokenExpiry.setDate(tokenExpiry.getDate() + WELCOME_TTL_DAYS);
  await setPasswordResetToken(owner.email_address, token, tokenExpiry);

  const url = welcomeUrl(token);
  const branding = await buildEmailBranding(orgId);
  const sent = await sendNotification({
    template: "welcome",
    params: {
      ownerFirstName: owner.first_name || "there",
      orgName: org.name,
      url,
      ttlDays: WELCOME_TTL_DAYS,
      isReminder: true,
    },
    recipient: { email: owner.email_address, branding },
  });
  return { url, emailDelivered: sent.delivered };
}
