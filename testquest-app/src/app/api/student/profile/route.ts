import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { handleApiError, parseBody, success, error } from "@/lib/api-utils";
import { findById, updateLegacyStudent } from "@/lib/legacy-students";

const updateSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  mobile: z.string().min(10).max(20).optional(),
  classId: z.number().int().positive().optional(),
  board: z.enum(["CBSE", "ICSE", "State"]).optional(),
});

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth("student");
    const body = await parseBody(request, updateSchema);

    await updateLegacyStudent(session.id, {
      name: body.name,
      mobile: body.mobile,
      classId: body.classId,
      // `board` not stored on legacy student row directly — silently ignored
      // until we add a proper column or repurpose subcategories_id.
    });

    const student = await findById(session.id);
    if (!student) return error("Profile not found", 404);

    return success({
      id: student.id,
      name: student.name,
      email: student.email,
      mobile: student.mobile,
      classId: student.classId,
      board: student.board,
      avatarUrl: student.avatarUrl,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
