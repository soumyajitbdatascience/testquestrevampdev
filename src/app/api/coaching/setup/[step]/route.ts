/**
 * POST /api/coaching/setup/[step]
 *
 * Per-step handler for the 5-step setup wizard (Task 1.4).
 * Steps: branding | classes | batch | invite | done
 *
 * All steps require an authenticated org member with OWNER or ADMIN role
 * (enforced via requireOrgRole). Each step persists the partial draft into
 * `Organization.brandingJson.setupProgress` so refresh-resumes work, and
 * advances `currentStep` plus appends to `completedSteps`.
 *
 * Step semantics:
 *  - branding: updates Organization.name / city / logoUrl + brandingJson.primaryColor
 *  - classes:  validates classIds against vw_classes; stores selection in draft
 *  - batch:    creates tq_batches via batch.service.createBatch and pins the
 *              new batchId to the draft so step 4 can use it
 *  - invite:   mode=link → issueInviteToken
 *              mode=roster → addStudentsToBatch
 *              mode=skip   → no-op
 *  - done:     clears setupProgress so the dashboard guard knows we're done
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgRole } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import {
  createBatch,
  addStudentsToBatch,
  issueInviteToken,
  writeSetupProgress,
  readSetupProgress,
  clearSetupProgress,
} from "@/lib/services/batch.service";
import type { Prisma } from "@/generated/prisma/client";

type Params = { params: Promise<{ step: string }> };

const STEPS = ["branding", "classes", "batch", "invite", "done"] as const;
type StepKey = typeof STEPS[number];

const brandingSchema = z.object({
  displayName: z.string().min(1).max(300).optional(),
  city: z.string().min(1).max(100).optional(),
  primaryColor: z.string().max(60).optional(),
  logoUrl: z.string().max(500).nullable().optional(),
});

const classesSchema = z.object({
  boards: z.array(z.string().min(1).max(40)).min(1).max(10),
  classIds: z.array(z.number().int().positive()).min(1).max(20),
});

const batchSchema = z.object({
  name: z.string().min(1).max(200),
  classId: z.number().int().positive(),
  board: z.string().min(1).max(50),
  subjects: z.array(z.string().min(1).max(80)).min(1).max(20),
});

const inviteSchema = z.object({
  mode: z.enum(["link", "roster", "skip"]),
  batchId: z.number().int().positive(),
  roster: z
    .array(z.object({
      name: z.string().min(1).max(200),
      mobile: z.string().min(10).max(20),
      email: z.string().email().max(200).optional(),
    }))
    .max(50)
    .optional(),
  validityDays: z.number().int().positive().max(180).optional(),
});

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN"]);
    const orgId = session.orgId!;
    const { step } = await params;
    if (!STEPS.includes(step as StepKey)) return error(`Unknown step: ${step}`, 404);

    switch (step as StepKey) {
      case "branding": {
        const body = await parseBody(request, brandingSchema);
        // Pull the existing brandingJson so we preserve any keys we don't touch.
        const org = await prisma.organization.findUniqueOrThrow({
          where: { id: orgId },
          select: { brandingJson: true },
        });
        const branding = (org.brandingJson ?? {}) as Record<string, unknown>;
        if (body.primaryColor) branding.primaryColor = body.primaryColor;

        await prisma.organization.update({
          where: { id: orgId },
          data: {
            ...(body.displayName ? { name: body.displayName } : {}),
            ...(body.city ? { city: body.city } : {}),
            ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
            brandingJson: branding as unknown as Prisma.InputJsonValue,
          },
        });
        await writeSetupProgress(orgId, {
          currentStep: 2,
          completedSteps: [1],
          draft: { branding: { ...body, logoUrl: body.logoUrl ?? undefined } },
        });
        return success({ nextStep: 2 });
      }

      case "classes": {
        const body = await parseBody(request, classesSchema);
        // Validate classIds against vw_classes.
        const placeholders = body.classIds.map(() => "?").join(",");
        const found = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
          `SELECT id FROM vw_classes WHERE isActive = 1 AND id IN (${placeholders})`,
          ...body.classIds,
        );
        const foundSet = new Set(found.map((r) => Number(r.id)));
        const missing = body.classIds.filter((id) => !foundSet.has(id));
        if (missing.length) return error(`Invalid classId(s): ${missing.join(", ")}`, 422);

        await writeSetupProgress(orgId, {
          currentStep: 3,
          completedSteps: [2],
          draft: { classes: body },
        });
        return success({ nextStep: 3 });
      }

      case "batch": {
        const body = await parseBody(request, batchSchema);
        const batch = await createBatch({ orgId, ...body });
        await writeSetupProgress(orgId, {
          currentStep: 4,
          completedSteps: [3],
          draft: { batch: { id: batch.id, ...body } },
        });
        return success({ nextStep: 4, batchId: batch.id });
      }

      case "invite": {
        const body = await parseBody(request, inviteSchema);
        if (body.mode === "link") {
          const token = await issueInviteToken({
            orgId,
            batchId: body.batchId,
            createdBy: session.id,
            validityDays: body.validityDays ?? 30,
          });
          await writeSetupProgress(orgId, { currentStep: 5, completedSteps: [4] });
          return success({
            nextStep: 5,
            mode: "link",
            token: token.token,
            url: `/coaching/join/${token.token}`,
            expiresAt: token.expiresAt,
          });
        }
        if (body.mode === "roster") {
          if (!body.roster || body.roster.length === 0) return error("Roster is empty", 400);
          const result = await addStudentsToBatch(orgId, body.batchId, body.roster);
          await writeSetupProgress(orgId, { currentStep: 5, completedSteps: [4] });
          return success({ nextStep: 5, mode: "roster", ...result });
        }
        // skip
        await writeSetupProgress(orgId, { currentStep: 5, completedSteps: [4] });
        return success({ nextStep: 5, mode: "skip" });
      }

      case "done": {
        await writeSetupProgress(orgId, { currentStep: 5, completedSteps: [5] });
        // Snapshot what got built before we wipe the draft.
        const progress = await readSetupProgress(orgId);
        const summary = {
          batchName: progress.draft?.batch?.name ?? null,
          batchId: progress.draft?.batch?.id ?? null,
          subjects: progress.draft?.batch?.subjects ?? [],
        };
        await clearSetupProgress(orgId);
        return success({ done: true, redirect: "/coaching/dashboard", summary });
      }
    }
  } catch (err) {
    return handleApiError(err);
  }
}
