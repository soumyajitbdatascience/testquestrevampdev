import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, success } from "@/lib/api-utils";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Admin student list, from `tq_students`.
 *
 * The table starts empty on this database — legacy students are deliberately
 * not migrated, so it fills up as people sign up.
 *
 * A student has no class column any more: which board and class they study is
 * a StudentContext, and there can be more than one. Pass status comes from
 * `tq_class_access`, where a row is active while `expiresAt` is in the future.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth("admin");

    const params = request.nextUrl.searchParams;
    const search = (params.get("search") ?? "").trim();
    const boardId = Number(params.get("boardId")) || undefined;
    const classId = Number(params.get("classId")) || undefined;
    const page = Math.max(1, Number(params.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, Number(params.get("limit") || "25")));
    const now = new Date();

    const where: Prisma.StudentWhereInput = {
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { email: { contains: search } },
              { mobile: { contains: search } },
            ],
          }
        : {}),
      ...(boardId || classId
        ? { contexts: { some: { ...(boardId ? { boardId } : {}), ...(classId ? { classId } : {}) } } }
        : {}),
    };

    const [total, rows, activePasses] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, name: true, email: true, mobile: true,
          emailVerified: true, isActive: true, createdAt: true,
          contexts: {
            orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
            select: { boardId: true, classId: true, isPrimary: true },
          },
          _count: { select: { attempts: true, orders: true } },
        },
      }),
      prisma.classAccess.findMany({
        where: { expiresAt: { gt: now } },
        select: { studentId: true, boardId: true, classId: true, expiresAt: true },
      }),
    ]);

    // Resolve board/class names once rather than per row.
    const [boards, classes] = await Promise.all([
      prisma.board.findMany({ select: { id: true, code: true } }),
      prisma.class.findMany({ select: { id: true, name: true } }),
    ]);
    const boardCode = new Map(boards.map((b) => [b.id, b.code]));
    const className = new Map(classes.map((c) => [c.id, c.name]));

    const passByStudent = new Map<number, { label: string; expiresAt: Date }>();
    for (const p of activePasses) {
      // Keep the longest-running pass when a student holds several.
      const existing = passByStudent.get(p.studentId);
      if (!existing || p.expiresAt > existing.expiresAt) {
        passByStudent.set(p.studentId, {
          label: `${boardCode.get(p.boardId) ?? "?"} · ${className.get(p.classId) ?? "?"}`,
          expiresAt: p.expiresAt,
        });
      }
    }

    return success({
      students: rows.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        mobile: s.mobile,
        emailVerified: s.emailVerified,
        isActive: s.isActive,
        joinedAt: s.createdAt,
        contexts: s.contexts.map((c) => ({
          boardId: c.boardId,
          classId: c.classId,
          isPrimary: c.isPrimary,
          label: `${boardCode.get(c.boardId) ?? "?"} · ${className.get(c.classId) ?? "?"}`,
        })),
        activePass: passByStudent.get(s.id) ?? null,
        attempts: s._count.attempts,
        orders: s._count.orders,
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
