/**
 * GET /api/coaching/questions
 *
 * Phase 2 / Task 2.3 — browse this org's private question bank.
 *
 * Query params:
 *   classId     (optional int)
 *   subject     (repeatable int)
 *   difficulty  EASY | MEDIUM | HARD | ALL (default ALL)
 *   type        SINGLE_MCQ | MULTI_MCQ | FILL_IN_BLANK | ALL (default ALL)
 *   q           free-text
 *   limit       1..60 (default 25)
 *   offset      >= 0
 */
import { NextRequest } from "next/server";
import { requireOrgRole } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import { listOrgQuestions } from "@/lib/services/question-bank.service";

const DIFFICULTIES = new Set(["EASY", "MEDIUM", "HARD", "ALL"]);
const TYPES = new Set(["SINGLE_MCQ", "MULTI_MCQ", "FILL_IN_BLANK", "ALL"]);

export async function GET(req: NextRequest) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN", "TEACHER"]);
    const params = req.nextUrl.searchParams;

    const classIdRaw = params.get("classId");
    const classId = classIdRaw ? Number(classIdRaw) : undefined;
    if (classId !== undefined && (!Number.isFinite(classId) || classId <= 0)) {
      return error("Bad classId", 400);
    }
    const subjectIds = params.getAll("subject")
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n) && n > 0);

    const difficulty = params.get("difficulty") ?? "ALL";
    if (!DIFFICULTIES.has(difficulty)) return error("Bad difficulty", 400);
    const type = params.get("type") ?? "ALL";
    if (!TYPES.has(type)) return error("Bad type", 400);

    const q = params.get("q") ?? undefined;
    const limit = Number(params.get("limit") ?? 25);
    const offset = Number(params.get("offset") ?? 0);

    const result = await listOrgQuestions({
      orgId: session.orgId!,
      classId,
      subjectIds: subjectIds.length ? subjectIds : undefined,
      difficulty: difficulty as "EASY" | "MEDIUM" | "HARD" | "ALL",
      type: type as "SINGLE_MCQ" | "MULTI_MCQ" | "FILL_IN_BLANK" | "ALL",
      query: q,
      limit: Number.isFinite(limit) ? limit : 25,
      offset: Number.isFinite(offset) ? offset : 0,
    });
    return success(result);
  } catch (err) {
    return handleApiError(err);
  }
}
