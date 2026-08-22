/**
 * GET /api/coaching/questions/[id] — inline question preview for the builder
 * and the org-questions page.
 *
 * Visibility (Phase 2 / Task 2.3):
 *   - Public Testquest-bank questions: visible to any org member.
 *   - Org-private questions (rows in tq_org_questions): visible only to
 *     members of the owning org. Other orgs get a 404, same shape as
 *     "doesn't exist."
 */
import { prisma } from "@/lib/db";
import { requireOrgRole } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import { getQuestionDetail } from "@/lib/services/test-builder.service";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN", "TEACHER"]);
    const { id } = await ctx.params;
    const qid = Number(id);
    if (!Number.isFinite(qid)) return error("Bad id", 400);

    // If this question is in any org's private bank, only members of THAT
    // org can read it. We do this lookup first because we expect ~all
    // questions to be Testquest-public for the foreseeable future, so this
    // is a cheap negative-case query.
    const orgMapping = await prisma.orgQuestion.findFirst({
      where: { legacyQuestionId: qid, isActive: true },
      select: { orgId: true },
    });
    if (orgMapping && orgMapping.orgId !== session.orgId) {
      return error("Not found", 404);
    }

    const detail = await getQuestionDetail(qid);
    if (!detail) return error("Not found", 404);
    return success({ question: detail });
  } catch (err) {
    return handleApiError(err);
  }
}
