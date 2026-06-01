/**
 * AssignmentCard — summary of one assignment (Task 1.7 / 1.8).
 *
 * UI_PLAN §4 vocabulary. For Phase 1 the assignment list is populated only
 * after Task 1.8 ships; this card shape is what we'll render then. The
 * completion-progress visual stays placeholder until Task 1.10 wires real
 * progress.
 */
import Link from "next/link";
import { ArrowRight, FileText, Clock } from "lucide-react";

export interface AssignmentCardProps {
  id: number;
  batchId: number;
  title: string | null;
  /** Fallback display when title is unset — falls back to test name. */
  testName?: string | null;
  dueAt?: Date | string | null;
  createdAt: Date | string;
  isActive: boolean;
  completionPct?: number | null;
}

function relativeOrAbsolute(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const mins = (+date - Date.now()) / 60_000;
  if (mins > 0 && mins < 60 * 48) return `due in ${Math.ceil(mins / 60)}h`;
  if (mins >= 60 * 48) return `due ${date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
  return `overdue ${date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
}

export function AssignmentCard({
  id, batchId, title, testName, dueAt, isActive, completionPct,
}: AssignmentCardProps) {
  const display = title ?? testName ?? "Untitled assignment";
  return (
    <Link
      href={`/coaching/batches/${batchId}/assignments/${id}`}
      className="block rounded-[14px] border bg-surface px-5 py-4 transition-all hover:border-primary/40"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary-dim text-primary flex-shrink-0">
          <FileText className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="font-display text-base text-foreground truncate">{display}</p>
            {!isActive && (
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Past</span>
            )}
          </div>
          {dueAt && (
            <p className="text-[11px] text-muted-foreground mt-0.5 inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {relativeOrAbsolute(dueAt)}
            </p>
          )}
          {completionPct != null && (
            <div className="mt-2.5">
              <div className="h-1 rounded-full bg-surface-hi overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.max(0, Math.min(100, completionPct))}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{completionPct}% completed</p>
            </div>
          )}
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground self-center flex-shrink-0" />
      </div>
    </Link>
  );
}
