import { redirect } from "next/navigation";

/**
 * Launch readiness moved to the admin home at /admin. This route stays so
 * existing links and bookmarks keep working.
 */
export default function LaunchReadinessRedirect() {
  redirect("/admin");
}
