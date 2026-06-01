/**
 * GET  /api/coaching/tests        — list this org's custom tests
 * POST /api/coaching/tests        — create a custom test
 *
 * Phase 2 / Task 2.2. Writes go through `createOrgTest` which delegates to
 * the legacy admin helpers, so attempts + scoring keep working without
 * special-casing org tests.
 */
import { z } from "zod";
import { requireOrgRole } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import {
  createOrgTest,
  listOrgTests,
  TestBuilderError,
} from "@/lib/services/test-builder.service";

export async function GET() {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN", "TEACHER"]);
    const tests = await listOrgTests(session.orgId!);
    return success({ tests });
  } catch (err) {
    return handleApiError(err);
  }
}

const createSchema = z.object({
  name:               z.string().min(3).max(300),
  description:        z.string().max(2000).optional().nullable(),
  classId:            z.number().int().positive(),
  subjectId:          z.number().int().positive(),
  durationMinutes:    z.number().int().min(5).max(360),
  passingPercentage:  z.number().int().min(0).max(100).optional(),
  questionIds:        z.array(z.number().int().positive()).min(1).max(200),
});

export async function POST(req: Request) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN", "TEACHER"]);
    const body = await parseBody(req, createSchema);
    const { id } = await createOrgTest({
      orgId:     session.orgId!,
      createdBy: session.id,
      ...body,
    });
    return success({ id }, 201);
  } catch (err) {
    if (err instanceof TestBuilderError) return error(err.message, err.status);
    return handleApiError(err);
  }
}
