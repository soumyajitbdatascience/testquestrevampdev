/**
 * GET  /api/coaching/team         — list active members + pending invites
 * POST /api/coaching/team         — invite a teammate (OWNER only)
 *
 * Phase 2 / Task 2.1. The list is cheap enough that we co-locate the two
 * resources in one response; the page renders both.
 */
import { z } from "zod";
import { requireOrgRole } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import {
  listMembers,
  listPendingInvites,
  inviteTeammate,
  TeamError,
} from "@/lib/services/team.service";

export async function GET() {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN", "TEACHER"]);
    const [members, pending] = await Promise.all([
      listMembers(session.orgId!),
      listPendingInvites(session.orgId!),
    ]);
    return success({ members, pending });
  } catch (err) {
    return handleApiError(err);
  }
}

const inviteSchema = z.object({
  email: z.string().email().max(255),
  name:  z.string().min(2).max(200),
  role:  z.enum(["TEACHER", "ADMIN"]),
});

export async function POST(req: Request) {
  try {
    const session = await requireOrgRole(["OWNER"]);
    const body = await parseBody(req, inviteSchema);
    const invite = await inviteTeammate({
      orgId:     session.orgId!,
      email:     body.email,
      name:      body.name,
      role:      body.role,
      invitedBy: session.id,
    });
    return success({ invite }, 201);
  } catch (err) {
    if (err instanceof TeamError) return error(err.message, err.status);
    return handleApiError(err);
  }
}
