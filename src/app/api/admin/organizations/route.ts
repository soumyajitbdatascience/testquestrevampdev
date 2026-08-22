/**
 * GET  /api/admin/organizations  — list with filters
 * POST /api/admin/organizations  — create org (sales-led)
 *
 * Phase 2 / Task 2.5. Admin staff only.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import {
  listOrganizations,
  createOrganizationSalesLed,
  OrgAdminError,
  type SalesStage,
  type OnboardingPath,
} from "@/lib/services/organization-admin.service";
import { OrgType, SubscriptionStatus } from "@/generated/prisma/client";

const STAGES = new Set(["PROSPECT", "DEMO", "PILOT", "ACTIVE", "CHURNED"]);
const PATHS = new Set(["SELF_SERVE", "SALES_LED"]);

export async function GET(req: NextRequest) {
  try {
    await requireAuth("admin");
    const p = req.nextUrl.searchParams;
    const typeRaw = p.get("type");
    const statusRaw = p.get("status");
    const stageRaw = p.get("salesStage");
    const pathRaw = p.get("onboardingPath");
    const limit = Number(p.get("limit") ?? 25);
    const offset = Number(p.get("offset") ?? 0);

    const type = typeRaw && (Object.values(OrgType) as string[]).includes(typeRaw) ? (typeRaw as OrgType) : undefined;
    const status = statusRaw && (Object.values(SubscriptionStatus) as string[]).includes(statusRaw) ? (statusRaw as SubscriptionStatus) : undefined;
    const salesStage = stageRaw && STAGES.has(stageRaw) ? (stageRaw as SalesStage) : undefined;
    const onboardingPath = pathRaw && PATHS.has(pathRaw) ? (pathRaw as OnboardingPath) : undefined;

    const result = await listOrganizations({
      type,
      status,
      salesStage,
      onboardingPath,
      q: p.get("q") ?? undefined,
      limit: Number.isFinite(limit) ? limit : 25,
      offset: Number.isFinite(offset) ? offset : 0,
    });
    return success(result);
  } catch (err) {
    return handleApiError(err);
  }
}

const createSchema = z.object({
  name:           z.string().min(2).max(300),
  city:           z.string().max(100).optional().nullable(),
  type:           z.enum(["COACHING_CENTRE", "SCHOOL", "B2C_FAMILY"]).optional(),
  ownerName:      z.string().min(2).max(200),
  ownerEmail:     z.string().email().max(255),
  planId:         z.number().int().positive(),
  seatsPurchased: z.number().int().positive().max(10_000).optional(),
  salesStage:     z.enum(["PROSPECT", "DEMO", "PILOT", "ACTIVE", "CHURNED"]).optional(),
  salesNotes:     z.string().max(4000).optional(),
  nextFollowupAt: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  try {
    await requireAuth("admin");
    const body = await parseBody(req, createSchema);
    const result = await createOrganizationSalesLed({
      ...body,
      type: body.type as OrgType | undefined,
    });
    return success(result, 201);
  } catch (err) {
    if (err instanceof OrgAdminError) return error(err.message, err.status);
    return handleApiError(err);
  }
}
