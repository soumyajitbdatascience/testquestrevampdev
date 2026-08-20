/**
 * /coaching/tests/new — custom test builder server shell.
 *
 * Phase 2 / Task 2.2. The server fetches the class + subject choices once
 * and hands off to the BuilderClient, which owns picker state, selection,
 * and the final POST.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { listClasses, listSubjects } from "@/lib/legacy-content";
import { CoachingHeader } from "@/components/coaching/coaching-header";
import { BuilderClient } from "./builder-client";

export const dynamic = "force-dynamic";

export default async function NewTestPage() {
  const session = await getSession();
  if (!session || !session.orgId) redirect("/coaching/login");
  if (session.orgRole === "STUDENT" || session.orgRole === "PARENT") redirect("/dashboard");

  const [classes, subjects] = await Promise.all([
    listClasses(),
    listSubjects(),
  ]);

  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <CoachingHeader />

      <main className="relative mx-auto max-w-[1280px] px-6 lg:px-10 py-8 pb-[160px]">
        <Link
          href="/coaching/tests"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to tests
        </Link>

        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Custom test</p>
        <h1 className="mt-1 font-display text-3xl md:text-4xl">Build a new test</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          Pick a class to load relevant questions. Filter by subject, difficulty, or type, then add questions to your test. You can preview any question inline before adding it.
        </p>

        <BuilderClient
          classes={classes.map((c) => ({ id: c.id, name: c.name }))}
          subjects={subjects.map((s) => ({ id: s.id, name: s.name, classId: s.classId }))}
        />
      </main>
    </div>
  );
}
