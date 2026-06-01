/**
 * /coaching/assignments/[id] — student-side assignment intro (Task 1.9).
 *
 * Server component. Resolves the assignment with the student's context,
 * renders the intro card (centre, batch, test details, due date, instructions)
 * and a "Start test" CTA that routes to /tests/[testId]?assignmentId=[id]
 * which is where the regular take-test flow takes over.
 *
 * Auth:
 *   - must be signed in
 *   - STUDENT-role org members: must be enrolled in the assignment's batch
 *   - OWNER/ADMIN/TEACHER: can preview the page (useful before sharing)
 *
 * Middleware allows this path through to the page; the page enforces.
 */
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Sparkles, Clock, FileText, Calendar } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { OrgLogo } from "@/components/student/org-logo";
import { PoweredByTestquest } from "@/components/student/powered-by-testquest";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function StudentAssignmentPage({ params }: Params) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const assignmentId = Number(id);
  if (!Number.isFinite(assignmentId)) notFound();

  const a = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      org:   { select: { name: true } },
      batch: { select: { id: true, name: true } },
    },
  });
  if (!a) notFound();
  if (!a.isActive) notFound();

  // Student-role gate.
  if (session.role === "student") {
    const isOrgMember = session.orgId === a.orgId;
    if (!isOrgMember) {
      // Probably a consumer student who clicked an invite link by mistake.
      return <NotForYou />;
    }
    if (session.orgRole === "STUDENT") {
      const enrolled = await prisma.batchEnrollment.findUnique({
        where: { batchId_studentId: { batchId: a.batchId, studentId: session.id } },
      });
      if (!enrolled || !enrolled.isActive) return <NotForYou />;
    }
  }

  const test = await prisma.$queryRaw<Array<{ id: number; name: string; durationMinutes: number }>>`
    SELECT id, name, durationMinutes FROM vw_tests WHERE id = ${a.testId} LIMIT 1
  `;
  const totalRow = await prisma.$queryRaw<Array<{ marks: number | null; q: bigint }>>`
    SELECT SUM(marks) AS marks, COUNT(*) AS q FROM vw_test_questions WHERE testId = ${a.testId}
  `;
  const totalMarks = Number(totalRow[0]?.marks ?? 0);
  const questionCount = Number(totalRow[0]?.q ?? 0);

  // Caller's existing mapping row, if any.
  const myAttempt = await prisma.assignmentAttempt.findFirst({
    where: { assignmentId, studentId: session.id },
    orderBy: { startedAt: "desc" },
  });
  const completed = !!myAttempt?.completedAt;

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div
        className="absolute top-[-120px] right-[60px] w-[640px] h-[640px] pointer-events-none animate-glow"
        style={{ background: "radial-gradient(circle, oklch(0.76 0.17 72 / 0.10), transparent 62%)" }}
      />

      <header className="relative">
        <div className="mx-auto max-w-[1280px] flex items-center justify-between px-6 py-5 lg:px-10">
          <Link href="/tests" className="flex items-center gap-3">
            <OrgLogo />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="relative px-6 pb-16 pt-2 lg:pt-6">
        <div className="mx-auto max-w-[560px]">
          <div className="inline-flex items-center gap-1.5 rounded-full border bg-surface px-3 py-1 text-xs text-muted-foreground mb-4">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            From {a.org?.name}
          </div>
          <p className="text-[11px] uppercase tracking-widest text-primary">{a.batch?.name}</p>
          <h1 className="mt-1 font-display text-3xl md:text-4xl leading-[1.1] text-balance">
            {a.title ?? test[0]?.name ?? "Assignment"}
          </h1>

          <div className="mt-5 rounded-[18px] border bg-surface p-5 space-y-4">
            <Row icon={FileText} label="Test" value={test[0]?.name ?? "—"} />
            <Row icon={Clock} label="Duration"
              value={
                test[0]?.durationMinutes
                  ? `${test[0].durationMinutes} minutes · ${questionCount} Qs · ${totalMarks} marks`
                  : `${questionCount} Qs · ${totalMarks} marks`
              }
            />
            {a.dueAt && (
              <Row icon={Calendar} label="Due"
                value={new Date(a.dueAt).toLocaleString("en-IN", {
                  day: "numeric", month: "short", year: "numeric",
                  hour: "numeric", minute: "2-digit",
                })}
              />
            )}
          </div>

          {a.instructions && (
            <div className="mt-5 rounded-[14px] border bg-background/40 px-5 py-4">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">Instructions</p>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{a.instructions}</p>
            </div>
          )}

          <div className="mt-7">
            {completed ? (
              <div className="space-y-3">
                <div className="rounded-md bg-primary-dim border border-primary/30 px-3 py-2 text-sm text-primary">
                  You've already completed this assignment.
                </div>
                <Link
                  href={`/tests/${a.testId}`}
                  className="inline-flex items-center gap-1.5 rounded-[10px] border border-strong px-5 py-2.5 text-sm hover:bg-white/5 transition-colors"
                >
                  Browse other tests
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <Link
                href={`/tests/${a.testId}?assignmentId=${a.id}`}
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary text-primary-foreground px-7 py-3.5 text-sm font-bold shadow-gold transition-transform hover:-translate-y-0.5"
              >
                {myAttempt ? "Continue test" : "Start test"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
          <PoweredByTestquest />
        </div>
      </main>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary-dim text-primary flex-shrink-0">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm">{value}</p>
      </div>
    </div>
  );
}

function NotForYou() {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="relative max-w-md text-center">
        <h1 className="font-display text-3xl md:text-4xl">This assignment isn't for you.</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Ask your centre owner for the right invite link, or check if you signed in with the right account.
        </p>
        <Link href="/tests" className="mt-6 inline-flex items-center gap-1.5 rounded-[10px] border border-strong px-5 py-2.5 text-sm hover:bg-white/5">
          Browse tests
        </Link>
      </div>
    </div>
  );
}
