/**
 * GET /api/coaching/questions/search
 *
 * Phase 2 / Task 2.2 — picker source for the custom-test builder.
 *
 * Query params:
 *   classId      (required, int)
 *   subject      (repeatable subject id) — e.g. ?subject=12&subject=15
 *   difficulty   EASY | MEDIUM | HARD | ALL (default ALL)
 *   type         SINGLE_MCQ | MULTI_MCQ | FILL_IN_BLANK | ALL (default ALL)
 *   q            free-text (substring of question text)
 *   limit        1..60 (default 25)
 *   offset       >= 0
 *
 * Returns `{ rows, total, limit, offset }`.
 *
 * Open to OWNER / ADMIN / TEACHER.
 */
import { NextRequest } from "next/server";
import { requireOrgRole } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import { searchQuestions } from "@/lib/services/test-builder.service";

const DIFFICULTIES = new Set(["EASY", "MEDIUM", "HARD", "ALL"]);
const TYPES = new Set(["SINGLE_MCQ", "MULTI_MCQ", "FILL_IN_BLANK", "ALL"]);
const SOURCES = new Set(["ALL", "TESTQUEST", "MINE"]);

export async function GET(req: NextRequest) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN", "TEACHER"]);
    const params = req.nextUrl.searchParams;

    const classId = Number(params.get("classId") ?? "");
    if (!Number.isFinite(classId) || classId <= 0) return error("classId required", 400);

    const subjectIds = params.getAll("subject")
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n > 0);

    const difficulty = params.get("difficulty") ?? "ALL";
    if (!DIFFICULTIES.has(difficulty)) return error("Bad difficulty", 400);
    const type = params.get("type") ?? "ALL";
    if (!TYPES.has(type)) return error("Bad type", 400);
    const source = params.get("source") ?? "ALL";
    if (!SOURCES.has(source)) return error("Bad source", 400);

    const q = params.get("q") ?? undefined;
    const limit = Number(params.get("limit") ?? 25);
    const offset = Number(params.get("offset") ?? 0);

    const result = await searchQuestions({
      orgId:      session.orgId!,
      classId,
      subjectIds: subjectIds.length ? subjectIds : undefined,
      difficulty: difficulty as "EASY" | "MEDIUM" | "HARD" | "ALL",
      type:       type as "SINGLE_MCQ" | "MULTI_MCQ" | "FILL_IN_BLANK" | "ALL",
      source:     source as "ALL" | "TESTQUEST" | "MINE",
      query:      q,
      limit:      Number.isFinite(limit) ? limit : 25,
      offset:     Number.isFinite(offset) ? offset : 0,
    });
    return success(result);
  } catch (err) {
    return handleApiError(err);
  }
}
