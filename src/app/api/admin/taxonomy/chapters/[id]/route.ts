import { handleApiError, success } from "@/lib/api-utils";

export async function GET() {
  try {
    return success({ error: "Chapters are not part of the legacy schema" }, 410);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH() {
  return success({ error: "Chapters are not part of the legacy schema" }, 410);
}

export async function DELETE() {
  return success({ error: "Chapters are not part of the legacy schema" }, 410);
}
