import { handleApiError, success } from "@/lib/api-utils";

// Excel bulk import is temporarily disabled while we wire it to the legacy
// question schema. Use the New question dialog for now.
export async function POST() {
  try {
    return success({ error: "Excel import is being rewired to the legacy schema. Use the New question dialog meanwhile." }, 503);
  } catch (err) {
    return handleApiError(err);
  }
}
