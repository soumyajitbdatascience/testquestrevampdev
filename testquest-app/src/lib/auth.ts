import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies, headers } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Roles in the coaching multi-tenancy layer. Mirrors the Prisma enum `OrgRole`
 * but kept as a TS literal here to avoid a runtime dependency on the Prisma
 * client in this file (used by middleware which runs in the edge runtime).
 */
export type OrgRole = "OWNER" | "ADMIN" | "TEACHER" | "STUDENT" | "PARENT";

export type TokenPayload = {
  id: number;
  email: string;
  role: "student" | "admin";
  /**
   * Phase 0+: set when the authenticated user has an active org membership.
   * Legacy tokens minted before this rollout don't have this field; treated
   * as `null` everywhere it's read.
   */
  orgId?: number | null;
  /** Role inside the organization. Defined only when orgId is set. */
  orgRole?: OrgRole | null;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN_SECONDS });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const raw = jwt.verify(token, JWT_SECRET) as TokenPayload;
    // Normalise legacy tokens: pre-coaching tokens have no orgId/orgRole.
    return {
      id: raw.id,
      email: raw.email,
      role: raw.role,
      orgId: raw.orgId ?? null,
      orgRole: raw.orgRole ?? null,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  let token = cookieStore.get("token")?.value;
  if (!token) {
    // Mobile clients (native Android app) authenticate with a Bearer header
    // instead of the httpOnly cookie. Cookie wins when both are present.
    const authHeader = (await headers()).get("authorization");
    if (authHeader?.startsWith("Bearer ")) token = authHeader.slice(7);
  }
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAuth(
  role?: "student" | "admin",
): Promise<TokenPayload> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  if (role && session.role !== role) throw new Error("Forbidden");
  return session;
}

/**
 * Require the authenticated user to have an active org membership with one of
 * the given OrgRoles. Used by /coaching/* route handlers.
 *
 * Throws "Unauthorized" if not signed in or no orgId, "Forbidden" if the
 * orgRole isn't in `roles`.
 */
export async function requireOrgRole(roles: OrgRole[]): Promise<TokenPayload> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  if (!session.orgId || !session.orgRole) throw new Error("Unauthorized");
  if (!roles.includes(session.orgRole)) throw new Error("Forbidden");
  return session;
}

/**
 * Task 4.4 — multi-branch access gate.
 *
 * Allow the request if the user has an active OrgMembership on `targetOrgId`
 * whose role is in `roles`, OR if `roles` permits OWNER/ADMIN AND the user
 * has an active OWNER/ADMIN membership on the target org's parent (cascade
 * from parent down — TEACHER does NOT cascade).
 *
 * Uses dynamic imports to avoid pulling Prisma into the edge runtime when
 * middleware imports this module.
 */
export async function requireOrgAccessForOrg(
  targetOrgId: number,
  roles: OrgRole[],
): Promise<TokenPayload> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const { prisma } = await import("@/lib/db");

  const direct = await prisma.orgMembership.findFirst({
    where: { userId: session.id, orgId: targetOrgId, isActive: true },
    select: { role: true },
  });
  if (direct && roles.includes(direct.role)) return session;

  const wantsAdminTier = roles.includes("OWNER") || roles.includes("ADMIN");
  if (!wantsAdminTier) throw new Error("Forbidden");

  const target = await prisma.organization.findUnique({
    where: { id: targetOrgId },
    select: { parentOrgId: true },
  });
  if (!target?.parentOrgId) throw new Error("Forbidden");

  const parentMembership = await prisma.orgMembership.findFirst({
    where: {
      userId: session.id,
      orgId: target.parentOrgId,
      isActive: true,
      role: { in: ["OWNER", "ADMIN"] },
    },
    select: { role: true },
  });
  if (parentMembership) return session;

  throw new Error("Forbidden");
}
