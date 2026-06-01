import { getTaxonomyTree } from "@/lib/legacy-content";
import { handleApiError, success } from "@/lib/api-utils";

export async function GET() {
  try {
    const tree = await getTaxonomyTree();
    // Shape matches the original Prisma-based response so frontends keep working
    return success(tree.map(c => ({
      id: c.id,
      name: c.name,
      subjects: c.subjects.map(s => ({ id: s.id, name: s.name, chapters: [] })),
    })));
  } catch (err) {
    return handleApiError(err);
  }
}
