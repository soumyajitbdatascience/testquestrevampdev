/**
 * DELETE /api/coaching/team/[membershipId] — revoke an active teammate.
 *
 * OWNER only. Guards: can't revoke OWNER, can't revoke self. The service
 * does the actual flip to isActive=false; future requests from that user
 * lose their orgRole on the next /api/auth/me refresh (or they have to log
 * in again — JWT cached until expiry, acceptable for MVP).
 *
 * Phase 4 / Task 4.6 — accepts optional `{reassignments}` body. When the
 * target is a TEACHER with active batch assignments, the service throws
 * `REQUIRES_REASSIGNMENT` with `meta.batches` so the client can render a
 * picker. We surface `meta` in the 4xx response so the UI knows what to do.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgRole } from "@/lib/auth";
import { handleApiError, success, error } from "@/lib/api-utils";
import { revokeMembership, TeamError, type RevokeReassignmentMeta } from "@/lib/services/team.service";

const bodySchema = z.object({
  // Map of batchId → replacement teacher userId. `null` = batch becomes owner-managed.
  reassignments: z.record(z.string(), z.number().int().positive().nullable()).optional(),
}).partial();

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ membershipId: string }> },
) {
  try {
    const session = await requireOrgRole(["OWNER"]);
    const { membershipId } = await ctx.params;
    const id = Number(membershipId);
    if (!Number.isFinite(id)) return error("Bad id", 400);

    // Optional body — Phase 4.6. Treat empty body as "no reassignments".
    let reassignments: Record<number, number | null> | undefined;
    try {
      const text = await req.text();
      if (text.trim().length > 0) {
        const parsed = bodySchema.safeParse(JSON.parse(text));
        if (parsed.success && parsed.data.reassignments) {
          reassignments = Object.fromEntries(
            Object.entries(parsed.data.reassignments).map(([k, v]) => [Number(k), v]),
          );
        }
      }
    } catch { /* no body or bad JSON — proceed without reassignments */ }

    try {
      await revokeMembership({
        orgId: session.orgId!,
        membershipId: id,
        actingUserId: session.id,
        reassignments,
      });
      return success({ revoked: true });
    } catch (err) {
      if (err instanceof TeamError) {
        // Bubble `meta` (batch list) so the client can render the picker.
        const meta = (err as TeamError & { meta?: RevokeReassignmentMeta }).meta;
        if (meta) {
          return NextResponse.json(
            { ok: false, error: err.message, code: err.code, meta },
            { status: err.status },
          );
        }
        return error(err.message, err.status);
      }
      throw err;
    }
  } catch (err) {
    return handleApiError(err);
  }
}
