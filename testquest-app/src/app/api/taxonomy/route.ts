import { getTaxonomyTree } from "@/lib/student-content";
import { handleApiError, success } from "@/lib/api-utils";

/**
 * Public class → subject tree. Re-pointed off the retired `vw_*` views onto
 * the offering model; the response shape is unchanged, since student browse,
 * profile, onboarding and two admin pickers all read it.
 */
export async function GET() {
  try {
    return success(await getTaxonomyTree());
  } catch (err) {
    return handleApiError(err);
  }
}
