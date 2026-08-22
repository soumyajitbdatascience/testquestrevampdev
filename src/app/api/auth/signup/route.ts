import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, signToken } from "@/lib/auth";
import { handleApiError, parseBody, success } from "@/lib/api-utils";
import { createStudent, createVerificationToken, findByEmail } from "@/lib/students";
import { sendVerification, sendWelcome } from "@/lib/email-lifecycle";
import { prisma } from "@/lib/db";

const signupSchema = z.object({
  name: z.string().min(2).max(200),
  email: z.string().email().max(200),
  mobile: z.string().min(10).max(20).optional(),
  password: z.string().min(6).max(100),
  // Class & board are no longer collected at signup (the catalogue shows all
  // tests regardless; class can be set later on the profile page). Both stay
  // accepted for backward compatibility with older clients.
  classId: z.number().int().positive().optional(),
  board: z.enum(["CBSE", "ICSE", "State"]).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, signupSchema);

    // Email uniqueness check
    const existing = await findByEmail(body.email);
    if (existing) {
      return NextResponse.json(
        { ok: false, error: "Email already registered" },
        { status: 409 }
      );
    }

    // Class is optional at signup and can be set later during onboarding.
    // When supplied it must be a real, active class.
    let boardId: number | null = null;
    if (body.classId != null) {
      const cls = await prisma.class.findFirst({
        where: { id: body.classId, isActive: true },
        select: { id: true },
      });
      if (!cls) {
        return NextResponse.json({ ok: false, error: "Invalid class" }, { status: 422 });
      }
      // A context needs a board too; resolve the code the client sent.
      if (body.board) {
        const board = await prisma.board.findFirst({
          where: { code: body.board.toUpperCase(), isActive: true },
          select: { id: true },
        });
        boardId = board?.id ?? null;
      }
    }

    const passwordHash = await hashPassword(body.password);

    const studentId = await createStudent({
      name: body.name,
      email: body.email,
      mobile: body.mobile ?? null,
      passwordHash,
      boardId,
      classId: body.classId ?? null,
    });

    // Verification and welcome are fire-and-forget: a provider hiccup must
    // not fail a signup that already succeeded. `sendOnce` makes a later retry
    // safe, so nothing is lost by not awaiting a failure here.
    try {
      const verifyToken = await createVerificationToken(studentId);
      await sendVerification(studentId, verifyToken);
      await sendWelcome(studentId);
    } catch (e) {
      console.error("Signup email failed:", e);
    }

    const token = signToken({
      id: studentId,
      email: body.email.toLowerCase(),
      role: "student",
    });

    const response = success({
      id: studentId,
      name: body.name,
      email: body.email.toLowerCase(),
      board: body.board,
      // For mobile clients that can't read the httpOnly cookie
      token,
    }, 201);
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (err) {
    return handleApiError(err);
  }
}
