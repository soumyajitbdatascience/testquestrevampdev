/**
 * /coaching/questions — Phase 2 / Task 2.3.
 *
 * The org's private question bank. Owner / Admin / Teacher can browse the
 * imported questions and upload more via .xlsx. Hands off to the client for
 * filters + upload + pagination.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { listClasses, listSubjects } from "@/lib/legacy-content";
import { CoachingHeader } from "@/components/coaching/coaching-header";
import { QuestionsClient } from "./questions-client";

export const dynamic = "force-dynamic";

export default async function CoachingQuestionsPage() {
  const session = await getSession();
  if (!session || !session.orgId) redirect("/coaching/login");
  if (session.orgRole === "STUDENT" || session.orgRole === "PARENT") redirect("/tests");

  const [classes, subjects] = await Promise.all([
    listClasses(),
    listSubjects(),
  ]);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <CoachingHeader />

      <main className="relative mx-auto max-w-[1100px] px-6 lg:px-10 py-8 pb-[120px]">
        <Link
          href="/coaching/dashboard"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to dashboard
        </Link>

        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Question bank</p>
        <h1 className="mt-1 font-display text-3xl md:text-4xl">Your private questions</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          Bulk-upload questions from a spreadsheet. They&apos;re scoped to your centre — students see them only when you assign a test that uses them.
        </p>

        <QuestionsClient
          classes={classes.map((c) => ({ id: c.id, name: c.name }))}
          subjects={subjects.map((s) => ({ id: s.id, name: s.name, classId: s.classId }))}
        />
      </main>
    </div>
  );
}
