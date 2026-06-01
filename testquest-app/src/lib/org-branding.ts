/**
 * Org branding resolver for student-facing pages (Task 3.5).
 *
 * The student layout calls `loadStudentOrgBranding(studentId)`, which looks
 * up the student's most-recent active coaching enrollment, joins the org's
 * Subscription + brandingJson.whiteLabel, and returns a flattened
 * `StudentBranding` object. If the student isn't in an org-branded context
 * (no active enrollment, or the org's plan doesn't allow white-labelling)
 * this returns `null` and the caller falls back to the default Testquest
 * chrome.
 *
 * Kept intentionally cheap: one query for the active enrollment + a couple
 * of follow-ups for the org row, branding JSON, and subscription state.
 */
import { prisma } from "@/lib/db";
import {
  isWhiteLabelAllowed,
  readBranding,
} from "@/lib/services/branding.service";
import { resolveSubscriptionState } from "@/lib/services/subscription.service";

export interface StudentBranding {
  orgId: number;
  orgName: string;
  /** Best logo for the current theme (light preferred, dark fallback). */
  logoUrl: string;
  logoDarkUrl: string;
  primaryColor: string;
  secondaryColor: string;
  displayName: string;
  supportEmail: string;
  supportPhone: string;
  /** True when the org's active plan is "Pro" + status === ACTIVE. */
  isPro: boolean;
  /** Plan gate from branding.service.ts. */
  whiteLabelAllowed: boolean;
}

/**
 * Resolve the org branding to apply for `studentId`, or `null` if this is
 * a plain B2C student / the org isn't allowed to white-label.
 */
export async function loadStudentOrgBranding(
  studentId: number,
): Promise<StudentBranding | null> {
  // Most-recent active enrollment → batch → org.
  const enrollment = await prisma.batchEnrollment.findFirst({
    where: { studentId, isActive: true },
    orderBy: { enrolledAt: "desc" },
    include: {
      batch: {
        select: {
          orgId: true,
          org: { select: { id: true, name: true, isActive: true } },
        },
      },
    },
  });

  const org = enrollment?.batch?.org;
  if (!org || !org.isActive) return null;

  const orgId = org.id;

  const [allowed, branding, sub] = await Promise.all([
    isWhiteLabelAllowed(orgId),
    readBranding(orgId),
    resolveSubscriptionState(orgId),
  ]);

  if (!allowed) return null;

  const logoUrl = branding.logoLightUrl || branding.logoDarkUrl || "";
  const logoDarkUrl = branding.logoDarkUrl || branding.logoLightUrl || "";

  const isPro = sub.status === "ACTIVE" && sub.planName === "Pro";

  return {
    orgId,
    orgName: org.name,
    logoUrl,
    logoDarkUrl,
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    displayName: branding.displayName || org.name,
    supportEmail: branding.supportEmail,
    supportPhone: branding.supportPhone,
    isPro,
    whiteLabelAllowed: allowed,
  };
}
