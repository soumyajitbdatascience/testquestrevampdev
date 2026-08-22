/**
 * POST /api/coaching/setup/logo
 *
 * Logo upload for the coaching setup wizard's branding step + the white-label
 * settings page (Task 3.4).
 *
 * Accepts: multipart/form-data with field "file"
 * Validates: image/png | image/jpeg | image/svg+xml, ≤ 2 MB
 * Query:    ?variant=light|dark|default — selects the filename suffix; default
 *           preserves the wizard's pre-existing `logo.<ext>` shape for back-compat.
 * Persists:  public/uploads/orgs/<orgId>/logo[-<variant>].<ext>
 * Returns:   { url: "/uploads/orgs/<orgId>/logo[-<variant>].<ext>" }
 *
 * UPLOADS_V2_TODO: the current implementation writes to the local public/
 * folder. This works in dev and on a single-box deploy, but will not survive
 * a Vercel build (read-only filesystem). When we ship to Vercel, swap for
 * Vercel Blob / S3 / Cloudinary and keep the URL shape the same so callers
 * don't change.
 */
import { promises as fs } from "fs";
import path from "path";
import { requireOrgRole } from "@/lib/auth";
import { error, handleApiError, success } from "@/lib/api-utils";

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
};

export async function POST(request: Request) {
  try {
    const session = await requireOrgRole(["OWNER", "ADMIN"]);
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) return error("No file provided", 400);
    if (!ACCEPT[file.type]) return error("Unsupported format. Use PNG, JPG, or SVG.", 415);
    if (file.size > MAX_BYTES) return error("File too large. Max 2 MB.", 413);

    const ext = ACCEPT[file.type];
    const url = new URL(request.url);
    const rawVariant = url.searchParams.get("variant");
    const variant: "light" | "dark" | "default" =
      rawVariant === "light" || rawVariant === "dark" ? rawVariant : "default";
    const filename = variant === "default" ? `logo.${ext}` : `logo-${variant}.${ext}`;

    const orgDir = path.join(process.cwd(), "public", "uploads", "orgs", String(session.orgId));
    await fs.mkdir(orgDir, { recursive: true });
    const filePath = path.join(orgDir, filename);
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buf);

    return success({ url: `/uploads/orgs/${session.orgId}/${filename}` });
  } catch (err) {
    return handleApiError(err);
  }
}
