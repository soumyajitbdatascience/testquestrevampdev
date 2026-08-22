import { prisma } from "@/lib/db";
import { paiseToRupees } from "@/lib/money";
import { requireAuth } from "@/lib/auth";
import { handleApiError, success } from "@/lib/api-utils";
import { resolveActiveContext, listStudentContexts } from "@/lib/student-context";
import { resolvePlanPricing, type PlanRow, type PlanDuration } from "@/lib/pricing";

/**
 * My subscriptions (design 1f): pass history (active + expired, one row per
 * purchase scope with latest expiry), payment history, and grandfathered
 * per-test purchases ("yours forever").
 *
 * This page **honours** the active context without being filtered by it. The
 * active class's card is flagged and sorted first so switching class re-focuses
 * the page — but every pass and every receipt stays visible, because this is
 * the record of what the student has paid for. Hiding a Class 6 pass because
 * they are currently looking at Class 7 would be hiding their own money, which
 * is not what scoping is for: scoping stops one class's *content* leaking into
 * another, and a receipt is not content.
 *
 * A class the student holds but has never bought gets a card too (`free: true`,
 * handoff 1g). Deriving the list purely from `tq_class_access` meant a
 * free-browsing class simply had no row here, so the page couldn't say what it
 * costs — a doorway, not a nag. `minPrice` comes from the same fail-closed
 * pricing resolver the paywall and checkout use, so a class with no buyable
 * term shows no price rather than a wrong one.
 */
export async function GET() {
  try {
    const session = await requireAuth("student");
    const now = new Date();
    const activeCtx = await resolveActiveContext(session.id);

    const passes = await prisma.classAccess.findMany({
      where: { studentId: session.id },
      orderBy: { expiresAt: "desc" },
    });

    const boards = await prisma.board.findMany({ select: { id: true, name: true, code: true } });
    const boardMap = new Map(boards.map((b) => [b.id, b]));
    const plans = await prisma.b2cPlan.findMany({ select: { id: true, durationMonths: true } });
    const planMap = new Map(plans.map((p) => [p.id, p.durationMonths]));
    const classes = await prisma.class.findMany({ select: { id: true, name: true } });
    const classMap = new Map(classes.map((c) => [c.id, c.name]));

    // Collapse to one card per (board, class) scope — latest expiry wins
    const scopeSeen = new Set<string>();
    const cards: Array<Record<string, unknown>> = [];
    for (const p of passes) {
      const key = `${p.boardId}:${p.classId}`;
      if (scopeSeen.has(key)) continue;
      scopeSeen.add(key);
      // "Active" means the window is open now — a renewal bought early has a
      // startsAt in the future and must not read as the live pass.
      const active = p.startsAt <= now && p.expiresAt > now;
      const pending = p.startsAt > now;
      const totalMs = p.expiresAt.getTime() - p.startsAt.getTime();
      const usedMs = now.getTime() - p.startsAt.getTime();
      cards.push({
        isActiveContext: !!activeCtx && activeCtx.boardId === p.boardId && activeCtx.classId === p.classId,
        free: false,
        minPrice: null,
        boardId: p.boardId,
        boardName: boardMap.get(p.boardId)?.name ?? "—",
        classId: p.classId,
        className: classMap.get(p.classId) ?? `Class ${p.classId}`,
        durationMonths: p.planId != null ? planMap.get(p.planId) ?? null : null,
        startsAt: p.startsAt,
        expiresAt: p.expiresAt,
        orderId: p.orderId,
        active,
        pending,
        /** What a renewal bought now would extend from — the rule in grantClassAccess. */
        renewFrom: p.expiresAt > now ? p.expiresAt : now,
        daysLeft: active ? Math.ceil((p.expiresAt.getTime() - now.getTime()) / 86400e3) : 0,
        elapsedPct: active && totalMs > 0 ? Math.min(100, Math.max(0, Math.round((usedMs / totalMs) * 100))) : 100,
      });
    }

    // Classes held but never bought — one card each, after the paid ones.
    const contexts = await listStudentContexts(session.id);
    const unpaid = contexts.filter((c) => !scopeSeen.has(`${c.boardId}:${c.classId}`));
    if (unpaid.length > 0) {
      const priced = await prisma.b2cPlan.findMany({
        where: {
          subjectId: null, isActive: true,
          OR: unpaid.map((c) => ({ boardId: c.boardId, classId: c.classId })),
        },
        select: { boardId: true, classId: true, durationMonths: true, price: true, isActive: true },
      });

      // Group by scope, then resolve each scope once. Prices go through the
      // shared resolver so a deactivated or zero-priced term is never offered.
      const rowsByScope = new Map<string, PlanRow[]>();
      for (const p of priced) {
        const k = `${p.boardId}:${p.classId}`;
        const list = rowsByScope.get(k) ?? [];
        list.push({
          boardId: p.boardId, classId: p.classId,
          durationMonths: p.durationMonths, price: Number(p.price), isActive: p.isActive,
        });
        rowsByScope.set(k, list);
      }
      const minByScope = new Map<string, number>();
      for (const [k, rows] of rowsByScope) {
        const [boardId, classId] = k.split(":").map(Number);
        const byDuration = resolvePlanPricing(rows, { boardId, classId }).byDuration;
        const usable = rows
          .map((r) => byDuration[r.durationMonths as PlanDuration])
          .filter((v): v is number => v != null);
        if (usable.length) minByScope.set(k, Math.min(...usable));
      }

      for (const c of unpaid) {
        const minPrice = minByScope.get(`${c.boardId}:${c.classId}`) ?? null;
        cards.push({
          isActiveContext: !!activeCtx && activeCtx.boardId === c.boardId && activeCtx.classId === c.classId,
          free: true,
          boardId: c.boardId,
          boardName: boardMap.get(c.boardId)?.name ?? "—",
          classId: c.classId,
          className: classMap.get(c.classId) ?? `Class ${c.classId}`,
          minPrice,
          durationMonths: null,
          startsAt: null,
          expiresAt: null,
          orderId: null,
          active: false,
          daysLeft: 0,
          elapsedPct: 0,
        });
      }
    }

    // Paid before free, then the class being viewed first within each — the
    // renew button most likely to be wanted shouldn't be furthest down.
    cards.sort((a, b) =>
      Number(!!a.free) - Number(!!b.free) ||
      Number(b.isActiveContext) - Number(a.isActiveContext));

    // Payment history — paid orders, newest first
    const orders = await prisma.order.findMany({
      where: { studentId: session.id, status: "PAID" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, itemType: true, finalAmount: true, createdAt: true,
        planId: true, razorpayPaymentId: true,
      },
    });
    const history = await Promise.all(orders.map(async (o) => {
      // B2C_PLAN is the only item type in the decoupled model.
      let desc = "Class pass";
      if (o.planId) {
        const plan = await prisma.b2cPlan.findUnique({ where: { id: o.planId } });
        if (plan) {
          desc = `${boardMap.get(plan.boardId)?.name ?? ""} ${classMap.get(plan.classId) ?? ""} — ${plan.durationMonths}-month pass`.trim();
        }
      }
      return {
        id: o.id,
        description: desc,
        // Orders store paise; history is read by a human. money.ts owns the
        // only conversion — nothing downstream divides again.
        amount: paiseToRupees(Number(o.finalAmount)),
        durationMonths: o.planId ? planMap.get(o.planId) ?? null : null,
        date: o.createdAt,
        method: o.razorpayPaymentId ? "Razorpay" : "Free (coupon)",
      };
    }));

    // Grandfathered per-test purchases came from `tq_student_access`, which
    // this database does not have — students start at zero here, so the list
    // is empty by construction. The key stays so the page keeps its shape.
    const gfTests: Array<{ testId: number; name: string; expiresAt: Date | null }> = [];

    return success({ passes: cards, history, purchasedTests: gfTests });
  } catch (err) {
    return handleApiError(err);
  }
}
