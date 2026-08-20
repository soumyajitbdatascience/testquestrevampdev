import { z } from "zod";
import { prisma } from "@/lib/db";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { verifyUnsubscribeToken } from "@/lib/email-send";

/**
 * Unsubscribe from lifecycle mail. **No login required** — someone who wants
 * out should not have to remember a password to get out, and a link that
 * demands a sign-in is a link people report as spam instead.
 *
 * The signed token is what authorises it: an HMAC of the student id, verified
 * in constant time. It never expires, so a link in a year-old email still
 * works. It cannot be guessed, and it grants nothing except this one switch.
 *
 * Transactional mail — verification, password reset, receipts — is unaffected
 * by design; those are records of something the student did.
 *
 * POST also serves RFC-8058 one-click unsubscribe, which mail clients call
 * directly from their own chrome.
 */
const schema = z.object({
  studentId: z.number().int().positive(),
  token: z.string().min(1),
}).strict();

async function applyOptOut(studentId: number, token: string) {
  if (!verifyUnsubscribeToken(studentId, token)) return null;
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, email: true },
  });
  if (!student) return null;
  await prisma.student.update({ where: { id: studentId }, data: { marketingOptOut: true } });
  return student;
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, schema);
    const student = await applyOptOut(body.studentId, body.token);
    if (!student) return error("This unsubscribe link isn't valid", 400);
    return success({ unsubscribed: true, email: student.email });
  } catch (err) {
    return handleApiError(err);
  }
}

/** GET form, for one-click links that arrive as a plain navigation. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const studentId = Number(url.searchParams.get("s"));
    const token = url.searchParams.get("t") ?? "";
    if (!Number.isInteger(studentId) || studentId <= 0) return error("Invalid link", 400);

    const student = await applyOptOut(studentId, token);
    if (!student) return error("This unsubscribe link isn't valid", 400);
    return success({ unsubscribed: true, email: student.email });
  } catch (err) {
    return handleApiError(err);
  }
}
