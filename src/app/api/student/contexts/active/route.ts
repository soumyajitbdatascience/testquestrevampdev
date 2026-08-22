import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { ACTIVE_CONTEXT_COOKIE, ACTIVE_CONTEXT_MAX_AGE } from "@/lib/student-context";

/**
 * Set the active board+class context (the `tq_ctx` cookie the header switcher
 * drives).
 *
 * Ownership is checked here rather than trusted from the client, and the read
 * side (`resolveActiveContext`) re-checks against the caller's own contexts
 * anyway — so a cookie written by any other means still cannot widen scope.
 */
const schema = z.object({ contextId: z.number().int().positive() }).strict();

export async function POST(request: Request) {
  try {
    const session = await requireAuth("student");
    const { contextId } = await parseBody(request, schema);

    const ctx = await prisma.studentContext.findFirst({
      where: { id: contextId, studentId: session.id },
      select: { id: true },
    });
    if (!ctx) return error("Context not found", 404);

    const res = success({ activeContextId: ctx.id });
    res.cookies.set(ACTIVE_CONTEXT_COOKIE, String(ctx.id), {
      path: "/",
      maxAge: ACTIVE_CONTEXT_MAX_AGE,
      sameSite: "lax",
      // Readable by the client shell for optimistic state; it carries no
      // authority, so httpOnly would buy nothing.
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
