import { handleApiError, success } from "@/lib/api-utils";

// Chapters are not part of the legacy schema. The admin UI hides the page,
// but we keep this stub so any cached callers see an empty list, not a 404.
export async function GET() {
  try {
    return success([]);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST() {
  return success({ error: "Chapters are not part of the legacy schema" }, 410);
}
