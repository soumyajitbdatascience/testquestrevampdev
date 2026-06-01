"use client";

/**
 * AssignedToMe — student-side dashboard module shown on /tests for org
 * members. Pulls /api/student/assignments and renders pending + recent
 * completions.
 *
 * Renders nothing for students who aren't in any centre, so consumers don't
 * see an empty module.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Calendar, CheckCircle2, Clock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AssignmentRow {
  id: number;
  title: string;
  testId: number;
  testName: string | null;
  dueAt: string | null;
  org: { name: string };
  batch: { name: string };
  status: "not_started" | "in_progress" | "completed";
  completedAt: string | null;
}

function dueLine(dueAt: string | null): string | null {
  if (!dueAt) return null;
  const d = new Date(dueAt);
  const diffMs = +d - Date.now();
  const days = Math.ceil(diffMs / 86_400_000);
  if (diffMs < 0) return `Due ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · overdue`;
  if (days <= 2) return `Due ${d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`;
  return `Due ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
}

export function AssignedToMe() {
  const [rows, setRows] = useState<AssignmentRow[] | null>(null);

  useEffect(() => {
    fetch("/api/student/assignments")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setRows(d.data.assignments); })
      .catch(() => {});
  }, []);

  // Render nothing while loading or for consumer students (no rows).
  if (!rows || rows.length === 0) return null;

  const pending = rows.filter((r) => r.status !== "completed");
  if (pending.length === 0) return null;  // hide once all are done; keep /tests clean

  return (
    <section className="mb-8">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-display text-xl inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Assigned to you
        </h2>
        <span className="text-xs text-muted-foreground">
          {pending.length} pending · {rows[0].org.name}
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {pending.slice(0, 6).map((a) => (
          <Link
            key={a.id}
            href={`/coaching/assignments/${a.id}`}
            className={cn(
              "block rounded-[14px] border bg-surface px-4 py-4 transition-all hover:border-primary/40",
              a.status === "in_progress" && "border-primary/40",
            )}
          >
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {a.batch.name}
            </p>
            <p className="mt-1 font-display text-base text-foreground line-clamp-2">{a.title}</p>
            <div className="mt-3 flex items-center justify-between gap-3 text-[11px]">
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                {a.status === "in_progress" ? (
                  <>
                    <Clock className="h-3 w-3 text-primary" />
                    <span className="text-primary">In progress</span>
                  </>
                ) : a.status === "completed" ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-[color:var(--score-strong)]" />
                    <span>Done</span>
                  </>
                ) : a.dueAt ? (
                  <>
                    <Calendar className="h-3 w-3" />
                    {dueLine(a.dueAt)}
                  </>
                ) : (
                  <span>—</span>
                )}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-primary" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
