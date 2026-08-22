"use client";

/**
 * MonitorClient — assignment progress + per-student + topic-insights +
 * per-question stats. Polls the results endpoint on mount; "Send reminder"
 * button fires the bulk-SMS action.
 */
import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCircle2, Clock, Loader2, MinusCircle, Sparkles, TrendingDown, Users } from "lucide-react";
import { EmptyState } from "@/components/coaching/empty-state";
import { StatTileSkeleton, StudentRowSkeleton } from "@/components/coaching/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface StudentRow {
  studentId: number;
  name: string;
  mobile: string | null;
  status: "not_started" | "in_progress" | "completed";
  score: number | null;
  totalMarks: number | null;
  percentage: number | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface TopicRow {
  subjectId: number | null;
  subjectName: string | null;
  difficulty: string | null;
  questionCount: number;
  correctPct: number;
}

interface QuestionRow {
  questionId: number;
  text: string | null;
  subjectId: number | null;
  difficulty: string | null;
  attemptedCount: number;
  correctCount: number;
  attemptedPct: number;
  correctPct: number;
}

interface ResultsPayload {
  assignment: { id: number; title: string | null; batchId: number; dueAt: string | null; createdAt: string };
  summary: {
    enrolledTotal: number; startedCount: number; completedCount: number;
    averageScore: number | null; sufficientForInsights: boolean;
  };
  students: StudentRow[];
  topics: TopicRow[];
  questions: QuestionRow[];
}

function scoreColor(pct: number | null): string {
  if (pct == null) return "text-muted-foreground";
  if (pct >= 75) return "text-[color:var(--score-strong)]";
  if (pct >= 50) return "text-[color:var(--score-on-track)]";
  return "text-[color:var(--score-needs-work)]";
}

function relative(d: string | null): string {
  if (!d) return "—";
  const date = new Date(d);
  const diffMs = Date.now() - +date;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function MonitorClient({ assignmentId }: { assignmentId: number }) {
  const [data, setData] = useState<ResultsPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reminding, setReminding] = useState(false);
  const [remindMsg, setRemindMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/coaching/assignments/${assignmentId}/results`);
      const d = await res.json();
      if (d.ok) setData(d.data);
      else setLoadError(d.error || "Couldn't load results.");
    } catch {
      setLoadError("Couldn't reach the server. Check your connection and try again.");
    }
  }, [assignmentId]);

  useEffect(() => { load(); }, [load]);

  async function sendReminder() {
    if (reminding) return;
    setReminding(true); setRemindMsg(null);
    try {
      const res = await fetch(`/api/coaching/assignments/${assignmentId}/remind`, { method: "POST" });
      const d = await res.json();
      if (d.ok) {
        setRemindMsg(`Reminder sent to ${d.data.sent} of ${d.data.targeted} students.`);
      } else {
        setRemindMsg(d.error || "Couldn't send reminder. Try again.");
      }
    } catch {
      setRemindMsg("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setReminding(false);
    }
  }

  if (loadError && !data) {
    return (
      <div className="rounded-[14px] border border-destructive/40 bg-destructive/10 px-5 py-6 text-sm text-destructive flex items-center justify-between gap-3">
        <span>{loadError}</span>
        <button
          type="button"
          onClick={() => load()}
          className="text-xs underline hover:no-underline shrink-0"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-2 h-9 w-72" />
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTileSkeleton />
          <StatTileSkeleton />
          <StatTileSkeleton />
          <StatTileSkeleton />
        </div>
        <div className="mt-8 rounded-[14px] border bg-surface divide-y">
          <StudentRowSkeleton />
          <StudentRowSkeleton />
          <StudentRowSkeleton />
          <StudentRowSkeleton />
        </div>
      </div>
    );
  }

  const { summary, students, topics, questions } = data;
  const completionPct = summary.enrolledTotal > 0
    ? Math.round((summary.completedCount / summary.enrolledTotal) * 100)
    : 0;
  const dueLine = data.assignment.dueAt
    ? new Date(data.assignment.dueAt).toLocaleString("en-IN", {
        day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
      })
    : "No due date";

  const weakTopics = topics.slice(0, 3);
  const hardQuestions = [...questions].sort((a, b) => a.correctPct - b.correctPct).slice(0, 10);
  const notStartedCount = summary.enrolledTotal - summary.startedCount;

  return (
    <>
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Assignment</p>
      <h1 className="mt-1 font-display text-3xl md:text-4xl">{data.assignment.title ?? "Assignment"}</h1>

      {/* Status header */}
      <section className="mt-6 rounded-[18px] border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm">
              <span className="text-foreground font-medium">{summary.completedCount}</span>
              <span className="text-muted-foreground"> of </span>
              <span className="text-foreground font-medium">{summary.enrolledTotal}</span>
              <span className="text-muted-foreground"> completed</span>
              {summary.completedCount >= 1 && summary.averageScore != null && (
                <>
                  <span className="text-muted-foreground"> · avg </span>
                  <span className={cn("font-medium", scoreColor(summary.averageScore))}>
                    {summary.averageScore}%
                  </span>
                </>
              )}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Due: {dueLine}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Button
              type="button"
              onClick={sendReminder}
              disabled={reminding || notStartedCount === 0}
              variant="outline"
              className="border-strong"
              title={notStartedCount === 0 ? "Everyone has started" : `Remind ${notStartedCount} students who haven't started`}
            >
              {reminding ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Bell className="h-4 w-4" /> Send reminder</>)}
            </Button>
            {remindMsg && (
              <p className="text-[11px] text-primary">{remindMsg}</p>
            )}
          </div>
        </div>
        <div className="mt-4 h-1.5 rounded-full bg-surface-hi overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </section>

      {/* Tabs */}
      <Tabs defaultValue="students" className="mt-8">
        <TabsList className="overflow-x-auto justify-start max-w-full">
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="topics">Topic insights</TabsTrigger>
          <TabsTrigger value="questions">Questions</TabsTrigger>
        </TabsList>

        {/* Students */}
        <TabsContent value="students" className="mt-6">
          {students.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No students in this batch yet."
              body="Add students to the batch to see their progress here."
            />
          ) : (
            <div className="rounded-[14px] border bg-surface divide-y">
              {students.map((s) => (
                <div key={s.studentId} className="flex items-center gap-4 px-4 py-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-hi text-xs font-medium text-foreground/90">
                    {(s.name || "?").charAt(0).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {s.status === "completed" && s.completedAt
                        ? `Completed ${relative(s.completedAt)}`
                        : s.status === "in_progress" && s.startedAt
                          ? `Started ${relative(s.startedAt)}`
                          : "Not started"}
                    </p>
                  </div>
                  <StatusPill status={s.status} />
                  <div className="w-16 text-right">
                    <span className={cn("font-mono text-sm", scoreColor(s.percentage))}>
                      {s.percentage != null ? `${s.percentage}%` : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Topic insights */}
        <TabsContent value="topics" className="mt-6">
          {!summary.sufficientForInsights ? (
            <div className="rounded-[14px] border bg-surface px-5 py-6 text-sm text-muted-foreground inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Insights unlock once at least one student completes.
            </div>
          ) : weakTopics.length === 0 ? (
            <div className="rounded-[14px] border bg-surface px-5 py-6 text-sm text-muted-foreground">
              No question metadata available for this test yet.
            </div>
          ) : (
            <>
              <div className="rounded-[14px] border bg-surface p-5">
                <p className="text-[11px] uppercase tracking-widest text-primary flex items-center gap-1.5">
                  <TrendingDown className="h-3.5 w-3.5" />
                  Weakest topics
                </p>
                <div className="mt-4 space-y-3">
                  {weakTopics.map((t, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground w-6">{String(i + 1).padStart(2, "0")}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {t.subjectName ?? "—"}
                          <Badge variant="secondary" className="ml-2 text-[10px]">{t.difficulty ?? "—"}</Badge>
                        </p>
                        <div className="mt-1 h-1 rounded-full bg-surface-hi overflow-hidden">
                          <div
                            className="h-full"
                            style={{ width: `${t.correctPct}%`, background: t.correctPct < 50 ? "var(--score-needs-work)" : t.correctPct < 75 ? "var(--score-on-track)" : "var(--score-strong)" }}
                          />
                        </div>
                      </div>
                      <span className={cn("font-mono text-sm w-12 text-right", scoreColor(t.correctPct))}>{t.correctPct}%</span>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-[11px] text-muted-foreground">
                  Buckets by subject × difficulty. Lower correct-% = worth a revisit in class.
                </p>
              </div>
            </>
          )}
        </TabsContent>

        {/* Questions */}
        <TabsContent value="questions" className="mt-6">
          {questions.length === 0 ? (
            <div className="rounded-[14px] border bg-surface px-5 py-6 text-sm text-muted-foreground">
              Per-question stats appear once attempts come in.
            </div>
          ) : (
            <div className="rounded-[14px] border bg-surface divide-y">
              {hardQuestions.map((q) => (
                <div key={q.questionId} className="flex items-start gap-4 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm line-clamp-2">{q.text ?? `Question ${q.questionId}`}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {q.difficulty ?? "—"} · {q.attemptedCount} attempts
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn("font-mono text-sm", scoreColor(q.correctPct))}>{q.correctPct}%</p>
                    <p className="text-[10px] text-muted-foreground">correct</p>
                  </div>
                </div>
              ))}
              {questions.length > hardQuestions.length && (
                <p className="px-4 py-2 text-[11px] text-muted-foreground text-center">
                  Showing 10 hardest of {questions.length} questions.
                </p>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

function StatusPill({ status }: { status: StudentRow["status"] }) {
  if (status === "completed") return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary-dim text-primary px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-widest">
      <CheckCircle2 className="h-3 w-3" /> Done
    </span>
  );
  if (status === "in_progress") return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 text-primary px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-widest">
      <Clock className="h-3 w-3" /> In progress
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-surface-hi text-muted-foreground px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-widest">
      <MinusCircle className="h-3 w-3" /> Not started
    </span>
  );
}
