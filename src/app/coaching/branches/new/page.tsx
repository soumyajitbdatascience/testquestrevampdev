/**
 * /coaching/branches/new — Task 4.4.
 *
 * OWNER/ADMIN creates a new child organisation under the current parent org.
 * The current user becomes OWNER of the new branch. A 14-day TRIAL on the
 * Starter coaching plan is provisioned automatically so the branch can start
 * onboarding immediately.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { CoachingHeader } from "@/components/coaching/coaching-header";
import { NewBranchForm } from "./new-branch-form";

export const dynamic = "force-dynamic";

export default async function NewBranchPage() {
  const session = await getSession();
  if (!session || !session.orgId) redirect("/coaching/login");
  if (session.orgRole !== "OWNER" && session.orgRole !== "ADMIN") {
    redirect("/coaching/dashboard");
  }

  return (
    <div className="relative min-h-screen">
      <CoachingHeader variant="plain" role={session.orgRole} />
      <main className="relative mx-auto max-w-[640px] px-6 py-10">
        <Link
          href="/coaching/branches"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to branches
        </Link>
        <h1 className="font-display text-3xl md:text-4xl mb-2">Add a branch</h1>
        <p className="text-sm text-muted-foreground mb-8">
          You&apos;ll be set as the owner of the new branch and a 14-day trial will start.
        </p>
        <NewBranchForm />
      </main>
    </div>
  );
}
