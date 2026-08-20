import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success } from "@/lib/api-utils";

/**
 * The shared curriculum context (WORKING IN: board · class · subject) —
 * server-persisted per admin in tq_settings, so every Curriculum screen
 * opens where the admin left off.
 */
const keyFor = (adminId: number) => `admin_curriculum_ctx_${adminId}`;

const putSchema = z.object({
  boardId: z.number().int().nullable(),
  classId: z.number().int().nullable(),
  subjectId: z.number().int().nullable(),
});

export async function GET() {
  try {
    const session = await requireAuth("admin");
    const row = await prisma.setting.findUnique({ where: { settingKey: keyFor(session.id) } });
    return success(
      row?.settingValue
        ? JSON.parse(row.settingValue)
        : { boardId: null, classId: null, subjectId: null },
    );
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireAuth("admin");
    const body = await parseBody(request, putSchema);
    await prisma.setting.upsert({
      where: { settingKey: keyFor(session.id) },
      create: { settingKey: keyFor(session.id), settingValue: JSON.stringify(body) },
      update: { settingValue: JSON.stringify(body) },
    });
    return success(body);
  } catch (err) {
    return handleApiError(err);
  }
}
