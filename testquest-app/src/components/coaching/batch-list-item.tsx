/**
 * BatchListItem — single batch row: name + class + student count + quick assign.
 *
 * UI_PLAN §4 vocabulary. Renders as a horizontal card on desktop and a stacked
 * row on mobile. Click anywhere navigates to the batch detail page (Task 1.7);
 * Assign button on the right jumps straight to the assign-test flow (Task 1.8).
 */
import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";

export interface BatchListItemProps {
  id: number;
  name: string;
  className: string | null;
  board: string;
  studentCount: number;
  subjects: string[];
}

export function BatchListItem({ id, name, className, board, studentCount, subjects }: BatchListItemProps) {
  const subjectsLine = subjects.length > 0 ? subjects.slice(0, 3).join(" · ") : "No subjects set";
  const meta = [className, board].filter(Boolean).join(" · ");
  return (
    <div className="rounded-[14px] border bg-surface px-5 py-4 transition-all hover:border-primary/40">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Link href={`/coaching/batches/${id}`} className="flex-1 min-w-0">
          <p className="font-display text-lg text-foreground truncate">{name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {meta || "—"}
            {subjects.length > 0 && <span className="mx-2">·</span>}
            {subjects.length > 0 && <span>{subjectsLine}{subjects.length > 3 ? ` +${subjects.length - 3}` : ""}</span>}
          </p>
        </Link>
        <div className="flex items-center gap-4 md:gap-5">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {studentCount} {studentCount === 1 ? "student" : "students"}
          </span>
          <Link
            href={`/coaching/batches/${id}/assign`}
            className="inline-flex items-center gap-1 rounded-[8px] border border-strong px-3 py-1.5 text-xs text-foreground hover:bg-white/5 transition-colors"
          >
            Assign
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
