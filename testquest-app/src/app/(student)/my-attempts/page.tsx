import { redirect } from "next/navigation";

/**
 * History used to be a top-level page under the legacy header. It is now the
 * "Recent attempts" section of My progress, which is where a student looks for
 * their scores anyway.
 *
 * The route is kept as a redirect rather than deleted: it is linked from
 * bookmarks, older emails and the mobile app's web fallbacks, and a 404 for a
 * page that simply moved is a worse outcome than one hop.
 */
export default function MyAttemptsPage() {
  redirect("/progress");
}
