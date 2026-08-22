/**
 * Branding-for-email helper — Task 3.6.
 *
 * Maps an org's white-label settings into the `EmailBranding` shape consumed
 * by the notification dispatcher's HTML shell. Plan-gated: only TRIAL/Growth/
 * Pro orgs get branded emails; everyone else gets the default Testquest shell.
 *
 * Lives in its own module to avoid a circular import between `notifications.ts`
 * and the branding service (which itself imports the subscription service).
 */
import { prisma } from "@/lib/db";
import { isWhiteLabelAllowed, readBranding } from "@/lib/services/branding.service";
import type { EmailBranding } from "@/lib/notifications";

/**
 * Build an `EmailBranding` payload for the given org, or undefined when the
 * plan doesn't allow white-label / the org doesn't exist. Empty-string
 * branding fields are normalised to undefined so the shell falls back to
 * defaults rather than rendering blank.
 */
export async function buildEmailBranding(orgId: number): Promise<EmailBranding | undefined> {
  if (!(await isWhiteLabelAllowed(orgId))) return undefined;
  const wl = await readBranding(orgId);
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });
  if (!org) return undefined;
  const empty = (s: string | undefined): string | undefined =>
    s && s.length > 0 ? s : undefined;
  return {
    orgName: org.name,
    displayName: empty(wl.displayName) ?? org.name,
    logoUrl: empty(wl.logoLightUrl) ?? empty(wl.logoDarkUrl),
    primaryColor: empty(wl.primaryColor),
    supportEmail: empty(wl.supportEmail),
    supportPhone: empty(wl.supportPhone),
  };
}
