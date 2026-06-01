/**
 * /api/coaching/settings/branding (Task 3.4)
 *
 *   GET  → current whiteLabel sub-object (defaults filled).
 *   PUT  → merge a partial patch.
 *
 * Plan-gated: OWNER/ADMIN on Growth/Pro, or any TRIAL org. Starter ACTIVE/GRACE
 * is rejected with 402 and the upgrade copy the UI surfaces verbatim.
 *
 * Colors are length-capped here and validated for CSS-colour sanity in
 * branding.service.ts::updateBranding (S2 fix), which throws BrandingError →
 * surfaced as HTTP 400.
 */
import { z } from "zod";
import { requireOrgRole } from "@/lib/auth";
import { error, handleApiError, parseBody, success } from "@/lib/api-utils";
import {
  isWhiteLabelAllowed,
  readBranding,
  updateBranding,
  BrandingError,
} from "@/lib/services/branding.service";

const colorField = z.string().trim().max(60, "Color value too long").optional();
const urlField = z.string().trim().max(500).optional();
const textField = z.string().trim().max(120).optional();
const emailField = z.string().trim().max(200).email("Enter a valid email.").or(z.literal("")).optional();
const phoneField = z.string().trim().max(40).optional();

const updateSchema = z.object({
  primaryColor: colorField,
  secondaryColor: colorField,
  logoLightUrl: urlField,
  logoDarkUrl: urlField,
  displayName: textField,
  supportEmail: emailField,
  supportPhone: phoneField,
}).strict();

export async function GET() {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN"]);
    const whiteLabel = await readBranding(session.orgId!);
    return success({ whiteLabel });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN"]);
    const allowed = await isWhiteLabelAllowed(session.orgId!);
    if (!allowed) {
      return error("Upgrade to Growth or Pro to use white-label.", 402);
    }
    const patch = await parseBody(request, updateSchema);
    const whiteLabel = await updateBranding(session.orgId!, patch);
    return success({ whiteLabel });
  } catch (err) {
    if (err instanceof BrandingError) return error(err.message, 400);
    return handleApiError(err);
  }
}
