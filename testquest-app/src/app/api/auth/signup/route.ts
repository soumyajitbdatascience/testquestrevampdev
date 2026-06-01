import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, signToken } from "@/lib/auth";
import { handleApiError, parseBody, success } from "@/lib/api-utils";
import { createLegacyStudent, findByEmail } from "@/lib/legacy-students";
import { prisma } from "@/lib/db";

const signupSchema = z.object({
  name: z.string().min(2).max(200),
  email: z.string().email().max(200),
  mobile: z.string().min(10).max(20).optional(),
  password: z.string().min(6).max(100),
  classId: z.number().int().positive(),
  board: z.enum(["CBSE", "ICSE", "State"]),
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

    // Validate classId against the legacy catigories table (via view)
    const classRow = await prisma.$queryRaw<Array<{ id: number; name: string }>>`
      SELECT id, name FROM vw_classes WHERE id = ${body.classId} AND isActive = 1 LIMIT 1
    `;
    if (classRow.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid class" },
        { status: 422 }
      );
    }

    const passwordHash = await hashPassword(body.password);

    const studentId = await createLegacyStudent({
      name: body.name,
      email: body.email,
      mobile: body.mobile ?? null,
      passwordHash,
      classId: body.classId,
      board: body.board,
    });

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
