/**
 * The lifecycle sends, each one a thin join between data we already have and a
 * template. Nothing here computes anything a receipt could get wrong: amounts
 * come off `tq_orders` in paise, the validity date off the granted
 * `tq_class_access` row, and the term length off the plan.
 *
 * Every function is safe to call twice — `sendOnce` owns that.
 */
import { prisma } from "@/lib/db";
import { sendOnce, appUrl, unsubscribeUrl, type SendOutcome } from "@/lib/email-send";
import {
  buildReceipt, buildVerification, buildWelcome, buildPasswordReset,
  buildExpiryReminder, type ExpiryStage,
} from "@/emails/templates";

/**
 * Purchase receipt. Keyed on the order, so the verify/webhook race — which
 * legitimately calls this twice — sends exactly one.
 */
export async function sendReceipt(orderId: number): Promise<SendOutcome> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, studentId: true, status: true, amount: true, discount: true,
      finalAmount: true, couponCode: true, razorpayPaymentId: true, createdAt: true,
      boardId: true, classId: true,
      student: { select: { name: true } },
      plan: { select: { durationMonths: true } },
      classAccess: { orderBy: { expiresAt: "desc" }, take: 1, select: { expiresAt: true } },
    },
  });
  // A receipt is proof of a completed purchase — no order, not paid, or no
  // pass granted means there is nothing to attest to yet.
  if (!order || order.status !== "PAID") return { sent: false, reason: "no_recipient" };
  const access = order.classAccess[0];
  if (!access || !order.plan) return { sent: false, reason: "no_recipient" };

  // boardId/classId are snapshotted on the order, so a receipt reprints
  // correctly even if the plan was re-scoped afterwards.
  const [board, cls] = await Promise.all([
    order.boardId ? prisma.board.findUnique({ where: { id: order.boardId }, select: { name: true } }) : null,
    order.classId ? prisma.class.findUnique({ where: { id: order.classId }, select: { name: true } }) : null,
  ]);

  const mail = await buildReceipt({
    name: order.student.name,
    orderId: order.id,
    amount: Number(order.amount),
    discount: Number(order.discount),
    finalAmount: Number(order.finalAmount),
    couponCode: order.couponCode,
    paymentRef: order.razorpayPaymentId,
    boardName: board?.name ?? "",
    className: cls?.name ?? "",
    durationMonths: order.plan.durationMonths,
    expiresAt: access.expiresAt,
    purchasedAt: order.createdAt,
    dashboardUrl: `${appUrl()}/dashboard`,
  });

  return sendOnce({
    kind: "receipt",
    studentId: order.studentId,
    refKey: `order:${order.id}`,
    transactional: true, // a record of a payment, never suppressed
    ...mail,
  });
}

export async function sendVerification(studentId: number, token: string): Promise<SendOutcome> {
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { name: true } });
  if (!student) return { sent: false, reason: "no_recipient" };

  const mail = await buildVerification({
    name: student.name,
    verifyUrl: `${appUrl()}/verify-email?token=${token}`,
  });
  return sendOnce({
    kind: "verification",
    studentId,
    // Keyed on the token: re-requesting verification issues a new token and
    // must be able to send again.
    refKey: `token:${token}`,
    transactional: true,
    ...mail,
  });
}

export async function sendPasswordReset(studentId: number, token: string): Promise<SendOutcome> {
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { name: true } });
  if (!student) return { sent: false, reason: "no_recipient" };

  const mail = await buildPasswordReset({
    name: student.name,
    resetUrl: `${appUrl()}/reset-password?token=${token}`,
  });
  return sendOnce({
    kind: "password_reset",
    studentId,
    refKey: `token:${token}`,
    transactional: true,
    ...mail,
  });
}

export async function sendWelcome(studentId: number): Promise<SendOutcome> {
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { name: true } });
  if (!student) return { sent: false, reason: "no_recipient" };

  const mail = await buildWelcome({
    name: student.name,
    dashboardUrl: `${appUrl()}/dashboard`,
    unsubscribeUrl: unsubscribeUrl(studentId),
  });
  return sendOnce({ kind: "welcome", studentId, refKey: `student:${studentId}`, ...mail });
}

/**
 * One stage of the expiry series for one pass.
 *
 * `refKey` names the pass *and* the stage, so each threshold fires once per
 * pass — and a renewal, which creates a new `tq_class_access` row with a new
 * id, starts its own series rather than being suppressed by the old one's.
 */
export async function sendExpiryReminder(accessId: number, stage: ExpiryStage): Promise<SendOutcome> {
  const access = await prisma.classAccess.findUnique({
    where: { id: accessId },
    select: {
      id: true, studentId: true, boardId: true, classId: true, expiresAt: true,
      student: { select: { name: true } },
    },
  });
  if (!access) return { sent: false, reason: "no_recipient" };

  const [board, cls] = await Promise.all([
    prisma.board.findUnique({ where: { id: access.boardId }, select: { name: true } }),
    prisma.class.findUnique({ where: { id: access.classId }, select: { name: true } }),
  ]);

  const mail = await buildExpiryReminder({
    name: access.student.name,
    stage,
    boardName: board?.name ?? "",
    className: cls?.name ?? "",
    expiresAt: access.expiresAt,
    renewUrl: `${appUrl()}/my-subscriptions`,
    unsubscribeUrl: unsubscribeUrl(access.studentId),
  });

  return sendOnce({
    kind: `expiry_${stage}`,
    studentId: access.studentId,
    refKey: `access:${access.id}`,
    ...mail,
  });
}
