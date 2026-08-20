import { handleApiError, success, error } from "@/lib/api-utils";
import { listClassesForBoard } from "@/lib/student-content";

type Params = { params: Promise<{ id: string }> };

/**
 * Public: the classes a board actually runs, for onboarding's second step.
 *
 * Onboarding used to offer every class in the system regardless of board,
 * which let a student bind themselves to a board+class combination that does
 * not exist. Each entry carries `offeringCount` so the picker can say "no
 * content yet" up front instead of landing them on an empty home.
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const boardId = Number(id);
    if (!Number.isFinite(boardId)) return error("Invalid board id", 400);

    return success(await listClassesForBoard(boardId));
  } catch (err) {
    return handleApiError(err);
  }
}
