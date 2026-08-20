import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

/**
 * Active board+class context — the scope every student page renders in.
 *
 * The active context is held in a `tq_ctx` cookie so the header's switcher
 * survives navigation without a schema change. The cookie is a *hint*, never
 * an authority: resolution always starts from the contexts this student
 * actually owns, so a forged, stale, or someone else's id resolves to their
 * own primary rather than to another student's class. Fail-closed by
 * construction — there is no code path where an unowned id is honoured.
 *
 * Holding a context is browsing scope, not entitlement. What may actually be
 * opened is still decided only by `hasClassAccess`.
 */

export const ACTIVE_CONTEXT_COOKIE = "tq_ctx";
/** One year — a student's class doesn't change mid-session. */
export const ACTIVE_CONTEXT_MAX_AGE = 60 * 60 * 24 * 365;

export type StudentContextRow = {
  id: number;
  boardId: number;
  classId: number;
  isPrimary: boolean;
  createdAt: Date;
};

/** Primary first, then oldest — the order the switcher and the fallback use. */
export async function listStudentContexts(studentId: number): Promise<StudentContextRow[]> {
  return prisma.studentContext.findMany({
    where: { studentId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    select: { id: true, boardId: true, classId: true, isPrimary: true, createdAt: true },
  });
}

/**
 * The context this request is scoped to, or `null` when the student has none
 * (which is the only state that may send them to onboarding).
 *
 * Pass `preloaded` when the caller has already listed the contexts — the
 * route-group layout does, and re-querying per API call would be waste.
 */
export async function resolveActiveContext<T extends { id: number }>(
  studentId: number,
  preloaded: T[],
): Promise<T | null>;
export async function resolveActiveContext(
  studentId: number,
): Promise<StudentContextRow | null>;
export async function resolveActiveContext(
  studentId: number,
  preloaded?: Array<{ id: number }>,
): Promise<{ id: number } | null> {
  const contexts = preloaded ?? (await listStudentContexts(studentId));
  if (contexts.length === 0) return null;

  const raw = (await cookies()).get(ACTIVE_CONTEXT_COOKIE)?.value;
  const requested = Number(raw);
  // `contexts` is already filtered to this student, so a hit here *is* the
  // ownership check. Miss for any reason → primary.
  const owned = Number.isFinite(requested)
    ? contexts.find((c) => c.id === requested)
    : undefined;

  return owned ?? contexts[0];
}

/**
 * Prisma `where` fragment scoping attempts to one context. Used by progress
 * and attempt history so neither can surface another class's papers.
 */
export function attemptScopeFor(ctx: { boardId: number; classId: number }) {
  return { test: { offering: { boardId: ctx.boardId, classId: ctx.classId } } };
}

export type StudentContextCard = {
  id: number;
  boardId: number;
  boardName: string;
  boardCode: string;
  classId: number;
  className: string;
  isPrimary: boolean;
  subscribed: boolean;
  passExpiresAt: Date | null;
};

/**
 * The switcher's rows: every context this student holds, with the board and
 * class names resolved and the live pass state attached.
 *
 * Shared by `GET /api/student/contexts` and the `(student)` layout so the
 * header the server renders and the list the API returns can never disagree.
 */
export async function listStudentContextCards(studentId: number): Promise<StudentContextCard[]> {
  const contexts = await listStudentContexts(studentId);
  if (contexts.length === 0) return [];

  const now = new Date();
  const [boards, classes, passes] = await Promise.all([
    prisma.board.findMany({ select: { id: true, name: true, code: true } }),
    prisma.class.findMany({ select: { id: true, name: true } }),
    prisma.classAccess.findMany({
      where: { studentId },
      select: { boardId: true, classId: true, expiresAt: true },
      orderBy: { expiresAt: "desc" },
    }),
  ]);
  const boardMap = new Map(boards.map((b) => [b.id, b]));
  const classMap = new Map(classes.map((c) => [c.id, c.name]));

  // Latest expiry per scope — a renewal writes a later row, never a shorter one.
  const expiry = new Map<string, Date>();
  for (const p of passes) {
    const k = `${p.boardId}:${p.classId}`;
    if (!expiry.has(k)) expiry.set(k, p.expiresAt);
  }

  return contexts.map((c) => {
    const exp = expiry.get(`${c.boardId}:${c.classId}`) ?? null;
    return {
      id: c.id,
      boardId: c.boardId,
      boardName: boardMap.get(c.boardId)?.name ?? "—",
      boardCode: boardMap.get(c.boardId)?.code ?? "",
      classId: c.classId,
      className: classMap.get(c.classId) ?? `Class ${c.classId}`,
      isPrimary: c.isPrimary,
      subscribed: !!exp && exp > now,
      passExpiresAt: exp,
    };
  });
}
