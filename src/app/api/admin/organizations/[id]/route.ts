/**
 * GET   /api/admin/organizations/[id] — detail
 * PATCH /api/admin/organizations/[id] — update CRM fields
 */
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import {
  getOrganizationDetail,
  updateOrganizationCrm,
  updateOrganizationParent,
  OrgAdminError,
} from "@/lib/services/organization-admin.service";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("admin");
    const { id } = await ctx.params;
    const orgId = Number(id);
    if (!Number.isFinite(orgId)) return error("Bad id", 400);
    const detail = await getOrganizationDetail(orgId);
    if (!detail) return error("Organization not found", 404);
    return success(detail);
  } catch (err) {
    return handleApiError(err);
  }
}

const patchSchema = z.object({
  salesStage:     z.enum(["PROSPECT", "DEMO", "PILOT", "ACTIVE", "CHURNED"]).optional(),
  salesNotes:     z.string().max(4000).nullable().optional(),
  nextFollowupAt: z.string().nullable().optional(),
  // Task 4.4 — admins can link/unlink a parent org for branch hierarchies.
  parentOrgId:    z.number().int().positive().nullable().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth("admin");
    const { id } = await ctx.params;
    const orgId = Number(id);
    if (!Number.isFinite(orgId)) return error("Bad id", 400);
    const body = await parseBody(req, patchSchema);

    let parent: { parentOrgId: number | null } | undefined;
    if (body.parentOrgId !== undefined) {
      parent = await updateOrganizationParent(orgId, body.parentOrgId);
    }
    const crmHasUpdates =
      body.salesStage !== undefined ||
      body.salesNotes !== undefined ||
      body.nextFollowupAt !== undefined;
    const sales = crmHasUpdates
      ? await updateOrganizationCrm(orgId, body)
      : undefined;

    return success({ sales, parentOrgId: parent?.parentOrgId });
  } catch (err) {
    if (err instanceof OrgAdminError) return error(err.message, err.status);
    return handleApiError(err);
  }
}
