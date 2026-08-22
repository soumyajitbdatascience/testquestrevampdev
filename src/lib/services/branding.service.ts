/**
 * Branding service — read/write white-label settings (Task 3.4).
 *
 * Storage: Organization.brandingJson.whiteLabel sub-object. Other keys in
 * `brandingJson` (setupProgress, onboardingDismissed, primaryColor from the
 * setup wizard) are preserved untouched — same merge pattern as
 * batch.service.ts::markOnboardingDismissed.
 *
 * The settings page is plan-gated to Growth / Pro (or TRIAL of any plan, so
 * trialing orgs can preview the feature). The gate predicate lives in the API
 * route + page shell — this service does not enforce it.
 */
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { resolveSubscriptionState } from "@/lib/services/subscription.service";

/**
 * Plan gate: white-label is a Growth/Pro feature. We also let any TRIAL org
 * preview it (so prospects on Starter trials get a feel for the upsell).
 *
 * Predicate: planName === "Growth" || planName === "Pro" || status === "TRIAL"
 */
export async function isWhiteLabelAllowed(orgId: number): Promise<boolean> {
  const state = await resolveSubscriptionState(orgId);
  if (state.status === "TRIAL") return true;
  return state.planName === "Growth" || state.planName === "Pro";
}

/**
 * Thrown by updateBranding when a caller supplies an invalid value (e.g. a
 * colour string that isn't a recognisable CSS colour). The API route maps this
 * to HTTP 400 with the message surfaced to the user.
 */
export class BrandingError extends Error {}

const NAMED_CSS_COLORS = new Set([
  "transparent", "currentcolor", "inherit",
  "black", "white", "red", "green", "blue", "yellow", "orange", "purple",
  "pink", "gray", "grey", "brown", "cyan", "magenta", "lime", "teal", "navy",
  "maroon", "olive", "silver", "gold", "indigo", "violet", "beige", "coral",
  "crimson", "turquoise", "salmon", "khaki", "orchid", "plum", "tan",
]);

/**
 * Lightweight CSS-colour sanity check. Accepts hex (#rgb/#rgba/#rrggbb/
 * #rrggbbaa), functional notations (rgb/rgba/hsl/hsla/hwb/lab/lch/oklab/oklch/
 * color), and common named colours. An empty string is allowed — that's how the
 * caller clears a colour field. This is intentionally permissive: the goal is to
 * reject obvious garbage (e.g. "not-a-color") before it poisons a CSS variable,
 * not to fully parse the CSS colour grammar.
 */
export function isValidCssColor(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (v === "") return true; // empty = clear the field
  if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(v)) return true;
  if (/^(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(/.test(v)) return true;
  return NAMED_CSS_COLORS.has(v);
}

export interface WhiteLabelBranding {
  primaryColor?: string;
  secondaryColor?: string;
  logoLightUrl?: string;
  logoDarkUrl?: string;
  displayName?: string;
  supportEmail?: string;
  supportPhone?: string;
}

const DEFAULTS: Required<WhiteLabelBranding> = {
  primaryColor: "",
  secondaryColor: "",
  logoLightUrl: "",
  logoDarkUrl: "",
  displayName: "",
  supportEmail: "",
  supportPhone: "",
};

/**
 * Read the whiteLabel sub-object, returning a fully-populated object (empty
 * strings for unset keys) so the page can render without null checks.
 */
export async function readBranding(orgId: number): Promise<Required<WhiteLabelBranding>> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { brandingJson: true },
  });
  const branding = (org?.brandingJson ?? {}) as { whiteLabel?: WhiteLabelBranding };
  const wl = branding.whiteLabel ?? {};
  return { ...DEFAULTS, ...wl };
}

/**
 * Merge `patch` into brandingJson.whiteLabel. Other top-level brandingJson
 * keys (setupProgress, onboardingDismissed, primaryColor) are preserved.
 *
 * Empty-string values are written through — that's how the caller clears a
 * field. `undefined` keys are dropped (no change).
 */
export async function updateBranding(
  orgId: number,
  patch: WhiteLabelBranding,
): Promise<Required<WhiteLabelBranding>> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { brandingJson: true },
  });
  if (!org) throw new Error("Organization not found");

  const current = (org.brandingJson ?? {}) as Record<string, unknown> & {
    whiteLabel?: WhiteLabelBranding;
  };
  const currentWl = current.whiteLabel ?? {};

  // Drop undefined keys from patch so they don't overwrite existing values.
  const cleanPatch: WhiteLabelBranding = {};
  for (const [k, v] of Object.entries(patch) as [keyof WhiteLabelBranding, string | undefined][]) {
    if (v !== undefined) cleanPatch[k] = v;
  }

  // Reject invalid colour strings before they reach a CSS variable on the client
  // (a value like "not-a-color" would silently break themed components).
  for (const key of ["primaryColor", "secondaryColor"] as const) {
    const val = cleanPatch[key];
    if (val !== undefined && !isValidCssColor(val)) {
      const label = key === "primaryColor" ? "Primary" : "Secondary";
      throw new BrandingError(
        `${label} colour must be a valid CSS colour (e.g. #2563eb, oklch(0.7 0.18 25), or a named colour like "blue").`,
      );
    }
  }

  const mergedWl: WhiteLabelBranding = { ...currentWl, ...cleanPatch };

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      brandingJson: { ...current, whiteLabel: mergedWl } as unknown as Prisma.InputJsonValue,
    },
  });

  return { ...DEFAULTS, ...mergedWl };
}
