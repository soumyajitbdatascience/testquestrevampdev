import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { handleApiError, success } from "@/lib/api-utils";

/**
 * Public: active boards.
 *
 * `?withClasses=1` narrows the list to boards that actually run at least one
 * class — the student onboarding case, where offering a board that leads to an
 * empty class picker is a dead end. It is **opt-in**: the default response is
 * unchanged, so the admin and every other caller keep seeing all boards.
 */
export async function GET(request: NextRequest) {
  try {
    const withClasses = request.nextUrl.searchParams.get("withClasses") === "1";

    const boards = await prisma.board.findMany({
      where: {
        isActive: true,
        ...(withClasses
          ? { boardClasses: { some: { isActive: true, class: { isActive: true } } } }
          : {}),
      },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, code: true },
    });
    return success(boards);
  } catch (err) {
    return handleApiError(err);
  }
}
