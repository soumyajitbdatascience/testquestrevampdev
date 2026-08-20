/**
 * /coaching/tests — list of custom tests this org has built.
 *
 * Phase 2 / Task 2.2. Owner / Admin / Teacher can view; everyone can also
 * jump straight to /coaching/tests/new from here.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, FileText, Plus } from "lucide-react";
import { getSession } from "@/lib/auth";
import { listOrgTests } from "@/lib/services/test-builder.service";
import { CoachingHeader } from "@/components/coaching/coaching-header";
import { EmptyState } from "@/components/coaching/empty-state";

export const dynamic = "force-dynamic";

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default async function CoachingTestsPage() {
  const session = await getSession();
  if (!session || !session.orgId) redirect("/coaching/login");
  if (session.orgRole === "STUDENT" || session.orgRole === "PARENT") redirect("/dashboard");

  const tests = await listOrgTests(session.orgId);

  return (
    <div className="relative min-h-screen overflow-x-clip">
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

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Custom tests</p>
            <h1 className="mt-1 font-display text-3xl md:text-4xl">Your test bank</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">
              Tests you build here are private to your centre. Assign them to batches just like Testquest tests.
            </p>
          </div>
          <Link
            href="/coaching/tests/new"
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold shadow-gold transition-transform hover:-translate-y-0.5 self-start md:self-auto"
          >
            <Plus className="h-4 w-4" />
            Create test
          </Link>
        </div>

        <div className="mt-8">
          {tests.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No custom tests yet."
              body="Build your first test from Testquest's question bank — set the duration, pick questions, and you're ready to assign it to a batch."
              ctaLabel="Create test"
              ctaHref="/coaching/tests/new"
            />
          ) : (
            <div className="rounded-[14px] border bg-surface divide-y">
              {tests.map((t) => (
                <div key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary-dim text-primary shrink-0">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.className ?? "—"} · {t.subjectName ?? "—"} · {t.questionCount} {t.questionCount === 1 ? "question" : "questions"} · {formatDuration(t.durationMinutes)} · {t.totalMarks} marks
                    </p>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {t.assignmentCount === 0 ? "Not assigned yet" : `Assigned ${t.assignmentCount}×`}
                  </span>
                  <span className="text-muted-foreground">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
