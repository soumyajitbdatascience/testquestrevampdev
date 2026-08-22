/**
 * Team service — Phase 2 / Task 2.1.
 *
 * Owns the lifecycle of teammates inside a coaching centre:
 *   1. List active members (OWNER + TEACHER + ADMIN) joined against legacy
 *      `student` for human-readable name/email.
 *   2. List pending invites (TeamInvite rows that aren't accepted/revoked/expired).
 *   3. Issue invite tokens with 7-day expiry, email a set-password link.
 *   4. Resolve + accept invites — creates legacy student row if needed, writes
 *      the OrgMembership, marks invite accepted.
 *   5. Revoke an active membership (TEACHER/ADMIN only — never OWNER).
 *   6. Cancel a pending invite.
 *
 * Email goes through `lib/email.ts` (stub; logs to console in dev). The
 * set-password URL is `${BASE_URL}/coaching/team/accept/<token>`.
 *
 * Why a separate model from `InviteToken`? That table is batch-scoped (student
 * join flow). Team invites need email + role + a different "ready for password"
 * accept page. Mixing the two would bloat both shapes.
 */
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  OrgRole,
  TeamInviteRole,
} from "@/generated/prisma/client";
import { hashPassword } from "@/lib/auth";
import { sendNotification } from "@/lib/notifications";
import { buildEmailBranding } from "@/lib/branding-for-email";
import {
  createLegacyStudent,
  findByEmail as findLegacyByEmail,
} from "@/lib/legacy-students";

export interface TeamMember {
  membershipId: number;
  userId: number;
  role: OrgRole;
  name: string | null;
  email: string | null;
  joinedAt: Date;
}

export interface PendingInvite {
  id: number;
  email: string;
  name: string;
  role: TeamInviteRole;
  invitedAt: Date;
  expiresAt: Date;
}

/**
 * Custom error so route handlers can map to 4xx without leaking internals.
 */
export class TeamError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

const INVITE_TTL_DAYS = 7;

function newToken(): string {
  return randomBytes(24).toString("hex"); // 48 chars
}

function expiryFromNow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + INVITE_TTL_DAYS);
  return d;
}

function inviteUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base}/coaching/team/accept/${token}`;
}

// ─── Reads ─────────────────────────────────────────────────────────

export async function listMembers(orgId: number): Promise<TeamMember[]> {
  const memberships = await prisma.orgMembership.findMany({
    where: { orgId, isActive: true, role: { in: [OrgRole.OWNER, OrgRole.ADMIN, OrgRole.TEACHER] } },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
  });
  if (memberships.length === 0) return [];
  const userIds = memberships.map((m) => m.userId);
  const placeholders = userIds.map(() => "?").join(",");
  const rows = await prisma.$queryRawUnsafe<Array<{ id: number; name: string; email: string | null }>>(
    `SELECT id, name, email FROM vw_students WHERE id IN (${placeholders})`,
    ...userIds,
  );
  const byId = new Map(rows.map((r) => [Number(r.id), r] as const));
  return memberships.map((m) => ({
    membershipId: m.id,
    userId: m.userId,
    role: m.role,
    name: byId.get(m.userId)?.name ?? null,
    email: byId.get(m.userId)?.email ?? null,
    joinedAt: m.joinedAt,
  }));
}

export async function listPendingInvites(orgId: number): Promise<PendingInvite[]> {
  const now = new Date();
  const invites = await prisma.teamInvite.findMany({
    where: {
      orgId,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });
  return invites.map((i) => ({
    id: i.id,
    email: i.email,
    name: i.name,
    role: i.role,
    invitedAt: i.createdAt,
    expiresAt: i.expiresAt,
  }));
}

// ─── Writes ────────────────────────────────────────────────────────

interface InviteInput {
  orgId: number;
  email: string;
  name: string;
  role: TeamInviteRole;
  invitedBy: number;
}

export async function inviteTeammate(input: InviteInput): Promise<PendingInvite> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) throw new TeamError("BAD_EMAIL", "That email doesn't look right.");

  // Already an active member of this org?
  const existing = await findLegacyByEmail(email);
  if (existing) {
    const member = await prisma.orgMembership.findFirst({
      where: { orgId: input.orgId, userId: existing.id, isActive: true },
    });
    if (member) {
      throw new TeamError("ALREADY_MEMBER", "That email is already a member of your centre.", 409);
    }
  }

  // Pending invite already?
  const pending = await prisma.teamInvite.findFirst({
    where: {
      orgId: input.orgId,
      email,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (pending) {
    throw new TeamError("ALREADY_INVITED", "An invite is already pending for that email.", 409);
  }

  const org = await prisma.organization.findUnique({
    where: { id: input.orgId },
    select: { name: true },
  });

  const token = newToken();
  const expiresAt = expiryFromNow();
  const invite = await prisma.teamInvite.create({
    data: {
      orgId: input.orgId,
      email,
      name: input.name.trim(),
      role: input.role,
      token,
      invitedBy: input.invitedBy,
      expiresAt,
    },
  });

  const branding = await buildEmailBranding(input.orgId);
  await sendNotification({
    template: "team-invite",
    params: {
      inviteeFirstName: input.name.trim().split(" ")[0] || "there",
      orgName: org?.name ?? "Your coaching centre",
      role: input.role,
      url: inviteUrl(token),
      ttlDays: INVITE_TTL_DAYS,
    },
    recipient: { email, branding },
  });

  return {
    id: invite.id,
    email: invite.email,
    name: invite.name,
    role: invite.role,
    invitedAt: invite.createdAt,
    expiresAt: invite.expiresAt,
  };
}

export async function resendInvite(orgId: number, inviteId: number): Promise<void> {
  const invite = await prisma.teamInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.orgId !== orgId) throw new TeamError("NOT_FOUND", "Invite not found.", 404);
  if (invite.acceptedAt || invite.revokedAt) {
    throw new TeamError("BAD_STATE", "That invite can't be resent.", 409);
  }
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });
  const branding = await buildEmailBranding(orgId);
  await sendNotification({
    template: "team-invite",
    params: {
      inviteeFirstName: invite.name.split(" ")[0] || "there",
      orgName: org?.name ?? "Your coaching centre",
      role: invite.role,
      url: inviteUrl(invite.token),
      ttlDays: INVITE_TTL_DAYS,
      isReminder: true,
    },
    recipient: { email: invite.email, branding },
  });
}

export async function cancelInvite(orgId: number, inviteId: number): Promise<void> {
  const invite = await prisma.teamInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.orgId !== orgId) throw new TeamError("NOT_FOUND", "Invite not found.", 404);
  if (invite.acceptedAt) throw new TeamError("BAD_STATE", "Already accepted.", 409);
  if (invite.revokedAt) return;
  await prisma.teamInvite.update({
    where: { id: invite.id },
    data: { revokedAt: new Date() },
  });
}

// ─── Accept flow ───────────────────────────────────────────────────

export interface ResolvedInvite {
  id: number;
  orgId: number;
  orgName: string;
  email: string;
  name: string;
  role: TeamInviteRole;
  expiresAt: Date;
  /**
   * If true, an existing legacy student row already matches this email — the
   * accept page should make it clear we're attaching to that account rather
   * than asking them to set a fresh password (their existing password still
   * works after accept). For MVP we still let them set a new one if they want.
   */
  hasExistingAccount: boolean;
}

export async function resolveTeamInvite(token: string): Promise<ResolvedInvite> {
  const invite = await prisma.teamInvite.findUnique({
    where: { token },
    include: { org: { select: { name: true } } },
  });
  if (!invite) throw new TeamError("NOT_FOUND", "We couldn't find that invite link.", 404);
  if (invite.acceptedAt) throw new TeamError("ACCEPTED", "This invite has already been used. Sign in to continue.", 410);
  if (invite.revokedAt) throw new TeamError("REVOKED", "This invite has been cancelled. Ask the centre owner for a new one.", 410);
  if (invite.expiresAt < new Date()) throw new TeamError("EXPIRED", "This invite has expired. Ask the centre owner for a new one.", 410);

  const existing = await findLegacyByEmail(invite.email);
  return {
    id: invite.id,
    orgId: invite.orgId,
    orgName: invite.org.name,
    email: invite.email,
    name: invite.name,
    role: invite.role,
    expiresAt: invite.expiresAt,
    hasExistingAccount: !!existing,
  };
}

export interface AcceptInput {
  token: string;
  password: string;
}

export interface AcceptResult {
  userId: number;
  orgId: number;
  orgRole: OrgRole;
  email: string;
}

export async function acceptTeamInvite({ token, password }: AcceptInput): Promise<AcceptResult> {
  // Re-validate (resolveTeamInvite throws on bad state).
  const resolved = await resolveTeamInvite(token);

  if (password.length < 6) {
    throw new TeamError("BAD_PASSWORD", "Use at least 6 characters for your password.");
  }
  const passwordHash = await hashPassword(password);

  // 1. Legacy student row — create if no match, else update password.
  let userId: number;
  const existing = await findLegacyByEmail(resolved.email);
  if (existing) {
    userId = existing.id;
    await prisma.$executeRawUnsafe(
      `UPDATE student SET password = ? WHERE student_id = ?`,
      passwordHash,
      userId,
    );
  } else {
    userId = await createLegacyStudent({
      name: resolved.name,
      email: resolved.email,
      passwordHash,
      classId: null,
      board: null,
    });
  }

  // 2. Membership row + mark invite accepted in one Prisma txn.
  const orgRole: OrgRole = resolved.role === "ADMIN" ? OrgRole.ADMIN : OrgRole.TEACHER;
  await prisma.$transaction(async (tx) => {
    // Reactivate or create membership.
    const existingMembership = await tx.orgMembership.findFirst({
      where: { orgId: resolved.orgId, userId, role: orgRole },
    });
    if (existingMembership) {
      if (!existingMembership.isActive) {
        await tx.orgMembership.update({
          where: { id: existingMembership.id },
          data: { isActive: true, joinedAt: new Date() },
        });
      }
    } else {
      await tx.orgMembership.create({
        data: { orgId: resolved.orgId, userId, role: orgRole, isActive: true },
      });
    }
    await tx.teamInvite.update({
      where: { id: resolved.id },
      data: { acceptedAt: new Date() },
    });
  });

  return { userId, orgId: resolved.orgId, orgRole, email: resolved.email };
}

// ─── Revoke ────────────────────────────────────────────────────────

interface RevokeInput {
  orgId: number;
  membershipId: number;
  actingUserId: number;
  /**
   * Phase 4 / Task 4.6 — when revoking a TEACHER who has active rows in
   * tq_batch_teachers, the owner must nominate replacements (or null = batch
   * becomes owner-managed) for every batch the teacher is assigned to. If
   * any batches need reassigning and this payload is missing, we throw
   * `REQUIRES_REASSIGNMENT` with `meta.batches` so the UI can render a
   * picker dialog.
   *
   * Shape: `{ [batchId]: replacementUserId | null }`.
   */
  reassignments?: Record<number, number | null>;
}

/**
 * 4.6 revoke needs a typed meta payload for the UI's reassignment dialog.
 * We extend TeamError to carry the batches list when we throw the
 * REQUIRES_REASSIGNMENT code.
 */
export interface RevokeReassignmentMeta {
  batches: Array<{ batchId: number; batchName: string }>;
}

export async function revokeMembership({ orgId, membershipId, actingUserId, reassignments }: RevokeInput): Promise<void> {
  const m = await prisma.orgMembership.findUnique({ where: { id: membershipId } });
  if (!m || m.orgId !== orgId) throw new TeamError("NOT_FOUND", "That teammate isn't in your centre.", 404);
  if (m.role === OrgRole.OWNER) throw new TeamError("OWNER_LOCKED", "You can't revoke the centre owner.", 403);
  if (m.userId === actingUserId) throw new TeamError("SELF_LOCKED", "You can't revoke yourself.", 403);
  if (!m.isActive) return;

  // 4.6: TEACHER membership? Check assigned batches.
  if (m.role === OrgRole.TEACHER) {
    // Lazy-import to avoid a circular dependency between team and batch-teachers.
    const { listBatchesForTeacher, applyReassignments } = await import("@/lib/services/batch-teachers.service");
    const batches = await listBatchesForTeacher(orgId, m.userId);
    if (batches.length > 0) {
      if (!reassignments) {
        const err = new TeamError(
          "REQUIRES_REASSIGNMENT",
          "This teacher has batches assigned. Pick a replacement (or leave it owner-managed) for each before removing them.",
          409,
        ) as TeamError & { meta: RevokeReassignmentMeta };
        err.meta = { batches };
        throw err;
      }
      // Confirm the plan covers every batch.
      const planned = new Set(Object.keys(reassignments).map((k) => Number(k)));
      const missing = batches.filter((b) => !planned.has(b.batchId));
      if (missing.length > 0) {
        throw new TeamError(
          "REASSIGNMENT_INCOMPLETE",
          `Pick a replacement for: ${missing.map((b) => b.batchName).join(", ")}.`,
          422,
        );
      }
      await applyReassignments({
        reassignments,
        fromUserId: m.userId,
        actingOrgId: orgId,
      });
    }
  }

  await prisma.orgMembership.update({
    where: { id: m.id },
    data: { isActive: false },
  });
}
