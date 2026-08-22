/**
 * GET /api/coaching/tests/search?classId=&subject=&q=
 *
 * Test picker for the assign-test flow. Owner / ADMIN only. Returns lightweight
 * test summaries scoped to the requested class (and optionally subject + free
 * text), capped at 60 results.
 */
import { NextRequest } from "next/server";
import { requireOrgRole } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import { searchTestsForPicker } from "@/lib/services/assignment.service";

export async function GET(req: NextRequest) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN", "TEACHER"]);
    const params = req.nextUrl.searchParams;
    const classId = Number(params.get("classId") ?? "");
    if (!Number.isFinite(classId) || classId <= 0) return error("classId required", 400);

    // Subject filter — repeatable param: ?subject=Mathematics&subject=Science
    const subjects = params.getAll("subject").map((s) => s.trim()).filter(Boolean);
    const q = params.get("q") ?? undefined;

    const rows = await searchTestsForPicker({ classId, orgId: session.orgId!, subjects, q });
    return success({ tests: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
