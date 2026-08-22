/**
 * ActivityFeedItem — one row in the dashboard's recent-activity feed.
 *
 * Shows "Student X completed Test Y · 82%" with a colored percentage chip
 * keyed off the existing score-strong / score-on-track / score-needs-work
 * tokens, plus a relative timestamp.
 */
import { cn } from "@/lib/utils";

export interface ActivityFeedItemProps {
  studentName: string | null;
  testName: string | null;
  percentage: number;
  finishedAt: Date | string | null;
}

function scoreClass(pct: number): string {
  if (pct >= 75) return "text-[color:var(--score-strong)]";
  if (pct >= 50) return "text-[color:var(--score-on-track)]";
  return "text-[color:var(--score-needs-work)]";
}

function relativeTime(d: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
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

export function ActivityFeedItem({ studentName, testName, percentage, finishedAt }: ActivityFeedItemProps) {
  const initial = (studentName ?? "?").charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-hi text-xs font-medium text-foreground/90 flex-shrink-0">
        {initial}
      </span>
      <div className="flex-1 min-w-0 text-sm">
        <p className="truncate">
          <span className="text-foreground">{studentName ?? "Unknown"}</span>
          <span className="text-muted-foreground"> completed </span>
          <span className="text-foreground">{testName ?? "a test"}</span>
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{relativeTime(finishedAt)}</p>
      </div>
      <span className={cn("font-mono text-sm flex-shrink-0", scoreClass(percentage))}>
        {Math.round(percentage)}%
      </span>
    </div>
  );
}
